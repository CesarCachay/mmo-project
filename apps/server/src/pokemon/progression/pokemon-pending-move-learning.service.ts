import { Injectable } from '@nestjs/common';

import {
  evaluatePokemonLevelEvolution,
  getPokemonMove,
  planPokemonEvolution,
  planPokemonMoveLearningSequence,
  resolvePokemonMoveLearningDecision,
} from '@cesar-mmo/shared';

import type {
  PokemonEvolutionPlan,
  PokemonInstance,
  PokemonLevelUpMoveCandidate,
  PokemonMoveLearningDecision,
  PokemonMoveLearningDecisionResult,
  PokemonMoveLearningSequenceResult,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonProgressionOperationQueue } from './pokemon-progression-operation.queue';

import {
  PokemonPendingMoveLearningPersistenceConflictError,
  PokemonPendingMoveLearningRepository,
} from './pokemon-pending-move-learning.repository';

import { PokemonPendingMoveLearningStore } from './pokemon-pending-move-learning.store';

import {
  toPendingMoveLearningCandidate,
  type PokemonPendingMoveLearningCandidate,
} from './pokemon-pending-move-learning.types';

import type { PokemonPendingEvolutionState } from '../evolution/pokemon-pending-evolution.types';
import { PokemonPendingEvolutionStore } from '../evolution/pokemon-pending-evolution.store';

export type PokemonPendingMoveLearningErrorCode =
  | 'TRAINER_STATE_NOT_FOUND'
  | 'POKEMON_NOT_IN_PARTY'
  | 'PENDING_NOT_FOUND'
  | 'MOVE_NOT_FOUND'
  | 'PERSISTENCE_CONFLICT'
  | 'PERSISTENCE_FAILED';

export class PokemonPendingMoveLearningError extends Error {
  constructor(
    public readonly code: PokemonPendingMoveLearningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonPendingMoveLearningError';
  }
}

export interface ResolvePendingMoveLearningInput {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;
  readonly decision: PokemonMoveLearningDecision;
  readonly expectedRevision?: number;
}

export interface ResolvePendingMoveLearningResult {
  readonly trainerState: PokemonTrainerState;
  readonly decision: PokemonMoveLearningDecisionResult;
  readonly continuation: PokemonMoveLearningSequenceResult;
  readonly hasNextPendingDecision: boolean;
  readonly pendingEvolution: PokemonPendingEvolutionState | null;
}

@Injectable()
export class PokemonPendingMoveLearningService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly pendingStore: PokemonPendingMoveLearningStore,
    private readonly repository: PokemonPendingMoveLearningRepository,
    private readonly operationQueue: PokemonProgressionOperationQueue,
    private readonly pendingEvolutionStore: PokemonPendingEvolutionStore,
  ) {}

  public resolveDecision(
    input: ResolvePendingMoveLearningInput,
  ): Promise<ResolvePendingMoveLearningResult> {
    return this.operationQueue.enqueue(
      input.trainerId,

      () => this.executeResolveDecision(input),
    );
  }

  private async executeResolveDecision(
    input: ResolvePendingMoveLearningInput,
  ): Promise<ResolvePendingMoveLearningResult> {
    const { trainerId, pokemonInstanceId, decision } = input;

    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonPendingMoveLearningError(
        'TRAINER_STATE_NOT_FOUND',
        `Trainer state not found for trainer "${trainerId}"`,
      );
    }

    const pokemon = trainerState.party.pokemon.find(
      (entry) => entry.instanceId === pokemonInstanceId,
    );

    if (!pokemon) {
      throw new PokemonPendingMoveLearningError(
        'POKEMON_NOT_IN_PARTY',
        `Pokémon "${pokemonInstanceId}" is not in trainer "${trainerId}" Party`,
      );
    }

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
      throw new PokemonPendingMoveLearningError(
        'PENDING_NOT_FOUND',
        `Pokémon "${pokemonInstanceId}" has no pending move-learning decision`,
      );
    }

    if (
      input.expectedRevision !== undefined &&
      pending.revision !== input.expectedRevision
    ) {
      throw new PokemonPendingMoveLearningError(
        'PERSISTENCE_CONFLICT',
        [
          `Pending move-learning revision mismatch`,
          `for Pokémon "${input.pokemonInstanceId}".`,
          `Expected "${input.expectedRevision}",`,
          `received "${pending.revision}".`,
        ].join(' '),
      );
    }

    /* Hydrate static move data from registry */
    const candidate = hydrateCandidate(pending.candidate, pokemon.moves);

    const decisionResult = resolvePokemonMoveLearningDecision({
      pending: {
        type: 'pending-decision',
        candidate,
        currentMoves: pokemon.moves.map((move) => ({
          ...move,
        })),
      },
      decision,
    });

    /* Continue with every candidate that came after the current pending move */
    const remainingCandidates = pending.remainingCandidates.map((entry) =>
      hydrateCandidate(entry, decisionResult.nextMoves),
    );

    const continuation = planPokemonMoveLearningSequence({
      currentMoves: decisionResult.nextMoves,
      candidates: remainingCandidates,
    });

    const nextPending =
      continuation.status === 'pending-decision'
        ? {
            candidate: toPendingMoveLearningCandidate(
              continuation.pendingDecision.candidate,
            ),
            remainingCandidates: continuation.remainingCandidates.map(
              toPendingMoveLearningCandidate,
            ),
          }
        : null;

    /*
     * --------------------------------------------------
     * Evolution continuation
     * --------------------------------------------------
     *
     * Evolution may only happen once ALL move-learning
     * decisions from this progression have been resolved.
     */
    const pokemonAfterMoveLearning: PokemonInstance = {
      ...pokemon,

      moves: continuation.currentMoves.map((move) => ({
        ...move,
      })),
    };

    let evolutionPlan: PokemonEvolutionPlan | null = null;

    if (nextPending === null) {
      const evaluation = evaluatePokemonLevelEvolution({
        speciesId: pokemonAfterMoveLearning.speciesId,
        level: pokemonAfterMoveLearning.level,
      });

      if (evaluation.status === 'eligible') {
        evolutionPlan = planPokemonEvolution({
          pokemon: pokemonAfterMoveLearning,
          candidate: evaluation.candidate,
        });
      }
    }

    const finalPokemonState = pokemonAfterMoveLearning;

    const pendingEvolutionCreation = evolutionPlan
      ? {
          sourceSpeciesId: evolutionPlan.sourceSpeciesId,
          sourceFormId: evolutionPlan.sourceFormId,
          targetSpeciesId: evolutionPlan.targetSpeciesId,
          targetFormId: evolutionPlan.targetFormId,
          triggerLevel: pokemonAfterMoveLearning.level,
        }
      : null;

    let pendingEvolutionState: PokemonPendingEvolutionState | null = null;

    /* PostgreSQL FIRST */
    try {
      await this.repository.applyDecision({
        trainerId,
        pokemonInstanceId,
        expectedSpeciesId: pokemon.speciesId,
        expectedFormId: pokemon.formId,
        expectedAbilityId: pokemon.abilityId,
        expectedCurrentHp: pokemon.currentHp,
        expectedLevel: pokemon.level,
        expectedExperience: pokemon.experience,
        expectedRevision: pending.revision,
        speciesId: finalPokemonState.speciesId,
        formId: finalPokemonState.formId,
        abilityId: finalPokemonState.abilityId,
        currentHp: finalPokemonState.currentHp,
        moves: finalPokemonState.moves,
        nextPending,
        pendingEvolution: pendingEvolutionCreation,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonPendingMoveLearningPersistenceConflictError) {
        throw new PokemonPendingMoveLearningError(
          'PERSISTENCE_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonPendingMoveLearning] persistence failed', {
        trainerId,
        pokemonInstanceId,
        decision,
        error,
      });

      throw new PokemonPendingMoveLearningError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon move-learning decision',
      );
    }

    /* RAM SECOND */
    const updatedParty = {
      pokemon: trainerState.party.pokemon.map((entry) =>
        entry.instanceId === pokemonInstanceId ? finalPokemonState : entry,
      ),
    };

    const updatedTrainerState = this.trainerStateStore.setParty(
      trainerId,
      updatedParty,
    );

    /* Update runtime pending cache only after PostgreSQL commit */
    if (nextPending) {
      this.pendingStore.set({
        trainerId,
        pokemonInstanceId,
        candidate: nextPending.candidate,
        remainingCandidates: nextPending.remainingCandidates,
        revision: pending.revision + 1,
      });
    } else {
      this.pendingStore.remove(pokemonInstanceId);
    }

    if (pendingEvolutionCreation) {
      pendingEvolutionState = {
        trainerId,
        pokemonInstanceId,
        sourceSpeciesId: pendingEvolutionCreation.sourceSpeciesId,
        sourceFormId: pendingEvolutionCreation.sourceFormId,
        targetSpeciesId: pendingEvolutionCreation.targetSpeciesId,
        targetFormId: pendingEvolutionCreation.targetFormId,
        triggerLevel: pendingEvolutionCreation.triggerLevel,
        revision: 0,
      };

      this.pendingEvolutionStore.set(pendingEvolutionState);
    }

    return {
      trainerState: updatedTrainerState,
      decision: decisionResult,
      continuation,
      hasNextPendingDecision: nextPending !== null,
      pendingEvolution: pendingEvolutionState,
    };
  }
}

function hydrateCandidate(
  candidate: PokemonPendingMoveLearningCandidate,
  currentMoves: readonly {
    moveId: number;
    currentPp: number;
  }[],
): PokemonLevelUpMoveCandidate {
  const move = getPokemonMove(candidate.moveId);

  if (!move) {
    throw new PokemonPendingMoveLearningError(
      'MOVE_NOT_FOUND',
      `Pokémon move "${candidate.moveId}" not found while restoring pending move-learning state`,
    );
  }

  return {
    moveId: candidate.moveId,
    learnedAtLevel: candidate.learnedAtLevel,
    move,
    alreadyKnown: currentMoves.some(
      (entry) => entry.moveId === candidate.moveId,
    ),
  };
}
