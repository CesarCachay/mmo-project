import { Injectable } from '@nestjs/common';

import {
  evaluatePokemonLevelEvolution,
  planPokemonEvolution,
} from '@cesar-mmo/shared';

import type {
  PokemonEvolutionDecision,
  PokemonEvolutionPlan,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonProgressionOperationQueue } from '../progression/pokemon-progression-operation.queue';

import {
  PokemonPendingEvolutionPersistenceConflictError,
  PokemonPendingEvolutionRepository,
} from './pokemon-pending-evolution.repository';

import { PokemonPendingEvolutionStore } from './pokemon-pending-evolution.store';

export type PokemonEvolutionDecisionErrorCode =
  | 'TRAINER_STATE_NOT_FOUND'
  | 'POKEMON_NOT_IN_PARTY'
  | 'PENDING_NOT_FOUND'
  | 'PERSISTENCE_CONFLICT'
  | 'EVOLUTION_NO_LONGER_ELIGIBLE'
  | 'PERSISTENCE_FAILED';

export class PokemonEvolutionDecisionError extends Error {
  constructor(
    public readonly code: PokemonEvolutionDecisionErrorCode,
    message: string,
  ) {
    super(message);

    this.name = 'PokemonEvolutionDecisionError';
  }
}

export interface ResolvePokemonEvolutionDecisionInput {
  readonly trainerId: PokemonTrainerId;

  readonly pokemonInstanceId: string;

  readonly decision: PokemonEvolutionDecision;

  readonly expectedRevision?: number;
}

export interface ResolvePokemonEvolutionDecisionResult {
  readonly trainerState: PokemonTrainerState;

  readonly decision: PokemonEvolutionDecision;

  /*
   * null when the user cancelled.
   *
   * Present only when ACCEPT successfully persisted
   * the Evolution.
   */
  readonly evolution: PokemonEvolutionPlan | null;
}

@Injectable()
export class PokemonEvolutionDecisionService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,

    private readonly pendingStore: PokemonPendingEvolutionStore,

    private readonly repository: PokemonPendingEvolutionRepository,

    private readonly operationQueue: PokemonProgressionOperationQueue,
  ) {}

  public resolveDecision(
    input: ResolvePokemonEvolutionDecisionInput,
  ): Promise<ResolvePokemonEvolutionDecisionResult> {
    return this.operationQueue.enqueue(
      input.trainerId,

      () => this.executeResolveDecision(input),
    );
  }

  private async executeResolveDecision(
    input: ResolvePokemonEvolutionDecisionInput,
  ): Promise<ResolvePokemonEvolutionDecisionResult> {
    const { trainerId, pokemonInstanceId, decision } = input;

    /*
     * --------------------------------------------------
     * 1. Authoritative runtime TrainerState
     * --------------------------------------------------
     */

    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonEvolutionDecisionError(
        'TRAINER_STATE_NOT_FOUND',
        `Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /*
     * --------------------------------------------------
     * 2. Pokémon must still belong to active Party
     * --------------------------------------------------
     */

    const pokemon = trainerState.party.pokemon.find(
      (entry) => entry.instanceId === pokemonInstanceId,
    );

    if (!pokemon) {
      throw new PokemonEvolutionDecisionError(
        'POKEMON_NOT_IN_PARTY',
        [
          `Pokémon "${pokemonInstanceId}"`,
          `is not in trainer "${trainerId}" Party`,
        ].join(' '),
      );
    }

    /*
     * --------------------------------------------------
     * 3. Restore Pending Evolution
     *
     * RAM cache first.
     * PostgreSQL remains durable authority.
     * --------------------------------------------------
     */

    let pending = this.pendingStore.getByPokemonInstanceId(pokemonInstanceId);

    if (!pending) {
      pending = await this.repository.findByPokemonInstanceId(
        trainerId,
        pokemonInstanceId,
      );

      if (pending) {
        this.pendingStore.set(pending);
      }
    }

    if (!pending) {
      throw new PokemonEvolutionDecisionError(
        'PENDING_NOT_FOUND',
        [`Pokémon "${pokemonInstanceId}"`, 'has no pending evolution'].join(
          ' ',
        ),
      );
    }

    /*
     * --------------------------------------------------
     * 4. Optimistic pending revision
     * --------------------------------------------------
     */

    if (
      input.expectedRevision !== undefined &&
      pending.revision !== input.expectedRevision
    ) {
      throw new PokemonEvolutionDecisionError(
        'PERSISTENCE_CONFLICT',
        [
          'Pending evolution revision mismatch',
          `for Pokémon "${pokemonInstanceId}".`,
          `Expected "${input.expectedRevision}",`,
          `received "${pending.revision}".`,
        ].join(' '),
      );
    }

    /*
     * --------------------------------------------------
     * 5. Source identity must still match
     * --------------------------------------------------
     */

    if (
      pokemon.speciesId !== pending.sourceSpeciesId ||
      pokemon.formId !== pending.sourceFormId
    ) {
      throw new PokemonEvolutionDecisionError(
        'PERSISTENCE_CONFLICT',
        [
          `Pokémon "${pokemonInstanceId}"`,
          'no longer matches its pending',
          'evolution source state',
        ].join(' '),
      );
    }

    /*
     * --------------------------------------------------
     * 6. ACCEPT → re-evaluate + build fresh plan
     *
     * CANCEL skips this completely.
     * --------------------------------------------------
     */

    let evolution: PokemonEvolutionPlan | null = null;

    if (decision.type === 'accept') {
      const evaluation = evaluatePokemonLevelEvolution({
        speciesId: pokemon.speciesId,
        level: pokemon.level,
      });

      /*
       * We intentionally evaluate again instead of
       * trusting the old pending blindly.
       */
      if (
        evaluation.status !== 'eligible' ||
        evaluation.candidate.targetSpeciesId !== pending.targetSpeciesId
      ) {
        throw new PokemonEvolutionDecisionError(
          'EVOLUTION_NO_LONGER_ELIGIBLE',
          [
            `Pokémon "${pokemonInstanceId}"`,
            'is no longer eligible for',
            `target species "${pending.targetSpeciesId}"`,
          ].join(' '),
        );
      }

      evolution = planPokemonEvolution({
        pokemon,
        candidate: evaluation.candidate,
      });

      /*
       * The canonical/default target form must still be
       * exactly the one stored when the pending was made.
       */
      if (evolution.targetFormId !== pending.targetFormId) {
        throw new PokemonEvolutionDecisionError(
          'PERSISTENCE_CONFLICT',
          [
            'Evolution target form changed',
            `for Pokémon "${pokemonInstanceId}".`,
            `Pending targetFormId="${pending.targetFormId}",`,
            `resolved targetFormId="${evolution.targetFormId}".`,
          ].join(' '),
        );
      }
    }

    /*
     * CANCEL:
     *
     * finalPokemon = original Pokémon.
     *
     * ACCEPT:
     *
     * finalPokemon = same instance transformed into target.
     */

    const finalPokemon = evolution?.evolvedPokemonState ?? pokemon;

    /*
     * --------------------------------------------------
     * 7. PostgreSQL FIRST
     * --------------------------------------------------
     */

    try {
      await this.repository.resolveDecision({
        trainerId,
        pokemonInstanceId,
        expectedRevision: pending.revision,
        expectedSpeciesId: pokemon.speciesId,
        expectedFormId: pokemon.formId,
        expectedAbilityId: pokemon.abilityId,
        expectedCurrentHp: pokemon.currentHp,
        expectedLevel: pokemon.level,
        expectedExperience: pokemon.experience,
        decision,
        evolvedPokemon: evolution?.evolvedPokemonState ?? null,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonPendingEvolutionPersistenceConflictError) {
        throw new PokemonEvolutionDecisionError(
          'PERSISTENCE_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonEvolution] persistence failed', {
        trainerId,
        pokemonInstanceId,
        decision,
        error,
      });

      throw new PokemonEvolutionDecisionError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon evolution decision',
      );
    }

    /*
     * --------------------------------------------------
     * 8. RAM SECOND
     * --------------------------------------------------
     */

    const updatedParty = {
      pokemon: trainerState.party.pokemon.map((entry) =>
        entry.instanceId === pokemonInstanceId ? finalPokemon : entry,
      ),
    };

    const updatedTrainerState = this.trainerStateStore.setParty(
      trainerId,
      updatedParty,
    );

    /*
     * --------------------------------------------------
     * 9. Pending cache only AFTER DB commit
     *
     * ACCEPT → remove
     * CANCEL → remove
     *
     * Cancel does NOT permanently disable Evolution.
     * A future Level Up can generate a new pending.
     * --------------------------------------------------
     */

    this.pendingStore.remove(pokemonInstanceId);

    return {
      trainerState: updatedTrainerState,
      decision,
      evolution,
    };
  }
}
