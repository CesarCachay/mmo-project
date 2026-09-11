import { Injectable } from '@nestjs/common';

import { getPokemonSpecies, planPokemonProgression } from '@cesar-mmo/shared';

import type {
  PokemonProgressionPlan,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonProgressionError } from './pokemon-progression.service';

import { PokemonProgressionOperationQueue } from './pokemon-progression-operation.queue';

import { PokemonPendingMoveLearningRepository } from './pokemon-pending-move-learning.repository';

import { PokemonPendingMoveLearningStore } from './pokemon-pending-move-learning.store';

import { toPendingMoveLearningCandidate } from './pokemon-pending-move-learning.types';

import {
  PokemonPartyProgressionPersistenceConflictError,
  PokemonPartyProgressionRepository,
} from './pokemon-party-progression.repository';

import { PokemonPendingEvolutionRepository } from '../evolution/pokemon-pending-evolution.repository';

import { PokemonPendingEvolutionStore } from '../evolution/pokemon-pending-evolution.store';

import type { PokemonPendingEvolutionState } from '../evolution/pokemon-pending-evolution.types';

export interface PokemonPartyExperienceApplication {
  readonly pokemonInstanceId: string;
  readonly gainedExperience: number;
}

export interface ApplyPokemonPartyExperienceInput {
  readonly trainerId: PokemonTrainerId;
  readonly rewards: readonly PokemonPartyExperienceApplication[];
}

export interface PokemonAppliedPartyProgression {
  readonly pokemonInstanceId: string;
  readonly gainedExperience: number;
  readonly progression: PokemonProgressionPlan;
  readonly pendingEvolution: PokemonPendingEvolutionState | null;
}

export interface ApplyPokemonPartyExperienceResult {
  readonly trainerState: PokemonTrainerState;
  readonly progressions: readonly PokemonAppliedPartyProgression[];
}

@Injectable()
export class PokemonPartyProgressionService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly repository: PokemonPartyProgressionRepository,
    private readonly operationQueue: PokemonProgressionOperationQueue,
    private readonly pendingRepository: PokemonPendingMoveLearningRepository,
    private readonly pendingStore: PokemonPendingMoveLearningStore,
    private readonly pendingEvolutionRepository: PokemonPendingEvolutionRepository,
    private readonly pendingEvolutionStore: PokemonPendingEvolutionStore,
  ) {}

  public applyPartyExperience(
    input: ApplyPokemonPartyExperienceInput,
  ): Promise<ApplyPokemonPartyExperienceResult> {
    return this.operationQueue.enqueue(
      input.trainerId,

      () => this.executeApplyPartyExperience(input),
    );
  }

  private async executeApplyPartyExperience(
    input: ApplyPokemonPartyExperienceInput,
  ): Promise<ApplyPokemonPartyExperienceResult> {
    const { trainerId, rewards } = input;

    /*
     * ------------------------------------------------------
     * 1. Runtime authority
     * ------------------------------------------------------
     */

    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonProgressionError(
        'TRAINER_STATE_NOT_FOUND',
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /*
     * ------------------------------------------------------
     * 2. Validate reward contract
     * ------------------------------------------------------
     */

    const rewardIds = rewards.map((reward) => reward.pokemonInstanceId);

    if (new Set(rewardIds).size !== rewardIds.length) {
      throw new Error(
        'Party EXP application contains duplicate Pokémon instance ids',
      );
    }

    for (const reward of rewards) {
      if (
        !Number.isInteger(reward.gainedExperience) ||
        reward.gainedExperience < 0
      ) {
        throw new Error(
          [
            'Invalid Battle EXP',
            `"${reward.gainedExperience}"`,
            'for Pokémon',
            `"${reward.pokemonInstanceId}"`,
          ].join(' '),
        );
      }
    }

    const applicableRewards = rewards.filter(
      (reward) => reward.gainedExperience > 0,
    );

    if (applicableRewards.length === 0) {
      return {
        trainerState,
        progressions: [],
      };
    }

    /*
     * ------------------------------------------------------
     * 3. Validate all targets BEFORE planning/persistence
     * ------------------------------------------------------
     */

    for (const reward of applicableRewards) {
      const pokemon = trainerState.party.pokemon.find(
        (entry) => entry.instanceId === reward.pokemonInstanceId,
      );

      if (!pokemon) {
        throw new PokemonProgressionError(
          'POKEMON_NOT_IN_PARTY',
          [
            `Pokémon "${reward.pokemonInstanceId}"`,
            `is not in trainer "${trainerId}" Party`,
          ].join(' '),
        );
      }

      /* Cache first */
      let pending = this.pendingStore.getByPokemonInstanceId(
        pokemon.instanceId,
      );

      /* PostgreSQL is durable authority */
      if (!pending) {
        pending = await this.pendingRepository.findByPokemonInstanceId(
          trainerId,
          pokemon.instanceId,
        );

        if (pending) {
          this.pendingStore.set(pending);
        }
      }

      if (pending) {
        throw new PokemonProgressionError(
          'PENDING_MOVE_LEARNING',

          [
            `Pokémon "${pokemon.instanceId}"`,
            'must resolve its pending move-learning decision',
            'before receiving Battle EXP',
          ].join(' '),
        );
      }

      let pendingEvolution = this.pendingEvolutionStore.getByPokemonInstanceId(
        pokemon.instanceId,
      );

      if (!pendingEvolution) {
        pendingEvolution =
          await this.pendingEvolutionRepository.findByPokemonInstanceId(
            trainerId,
            pokemon.instanceId,
          );

        if (pendingEvolution) {
          this.pendingEvolutionStore.set(pendingEvolution);
        }
      }

      if (pendingEvolution) {
        throw new PokemonProgressionError(
          'PENDING_EVOLUTION',

          [
            `Pokémon "${pokemon.instanceId}"`,
            'must resolve its pending evolution',
            'before receiving Battle EXP',
          ].join(' '),
        );
      }
    }

    /*
     * ------------------------------------------------------
     * 4. Plan ALL Pokémon before touching PostgreSQL
     * ------------------------------------------------------
     */

    const planned = applicableRewards.map((reward) => {
      const pokemon = trainerState.party.pokemon.find(
        (entry) => entry.instanceId === reward.pokemonInstanceId,
      );

      /* Already validated above */
      if (!pokemon) {
        throw new PokemonProgressionError(
          'POKEMON_NOT_IN_PARTY',
          `Pokémon "${reward.pokemonInstanceId}" disappeared from Trainer Party`,
        );
      }

      const species = getPokemonSpecies(pokemon.speciesId);

      if (!species) {
        throw new PokemonProgressionError(
          'SPECIES_NOT_FOUND',
          `Pokémon species "${pokemon.speciesId}" not found`,
        );
      }

      const progression = planPokemonProgression({
        pokemon,
        growthRate: species.growthRate,
        gainedExperience: reward.gainedExperience,
      });

      const automaticPokemon = progression.automaticPokemonState;

      const pendingMoveLearning =
        progression.moveLearning.status === 'pending-decision'
          ? {
              candidate: toPendingMoveLearningCandidate(
                progression.moveLearning.pendingDecision.candidate,
              ),
              remainingCandidates:
                progression.moveLearning.remainingCandidates.map(
                  toPendingMoveLearningCandidate,
                ),
            }
          : null;

      const evolutionPlan = progression.evolution.plan;

      const pendingEvolution =
        pendingMoveLearning === null && evolutionPlan !== null
          ? {
              sourceSpeciesId: evolutionPlan.sourceSpeciesId,
              sourceFormId: evolutionPlan.sourceFormId,
              targetSpeciesId: evolutionPlan.targetSpeciesId,
              targetFormId: evolutionPlan.targetFormId,
              triggerLevel: automaticPokemon.level,
            }
          : null;

      if (pendingMoveLearning && pendingEvolution) {
        throw new Error(
          [
            `Pokémon "${pokemon.instanceId}"`,
            'cannot create pending Move Learning',
            'and pending Evolution simultaneously',
          ].join(' '),
        );
      }

      return {
        reward,
        pokemon,
        progression,
        automaticPokemon,
        pendingMoveLearning,
        pendingEvolution,
      };
    });

    /*
     * ------------------------------------------------------
     * 5. PostgreSQL FIRST — ONE TRANSACTION
     * ------------------------------------------------------
     */

    try {
      await this.repository.applyPartyProgression({
        trainerId,
        entries: planned.map((entry) => ({
          pokemonInstanceId: entry.pokemon.instanceId,
          expectedSpeciesId: entry.pokemon.speciesId,
          expectedFormId: entry.pokemon.formId,
          expectedAbilityId: entry.pokemon.abilityId,
          expectedLevel: entry.pokemon.level,
          expectedExperience: entry.pokemon.experience,
          speciesId: entry.automaticPokemon.speciesId,
          formId: entry.automaticPokemon.formId,
          abilityId: entry.automaticPokemon.abilityId,
          level: entry.automaticPokemon.level,
          experience: entry.automaticPokemon.experience,
          currentHp: entry.automaticPokemon.currentHp,
          moves: entry.automaticPokemon.moves,
          pendingMoveLearning: entry.pendingMoveLearning,
          pendingEvolution: entry.pendingEvolution,
        })),
      });
    } catch (error: unknown) {
      if (error instanceof PokemonPartyProgressionPersistenceConflictError) {
        throw new PokemonProgressionError(
          'PERSISTENCE_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonPartyProgression] persistence failed', {
        trainerId,
        rewards: applicableRewards,
        error,
      });

      throw new PokemonProgressionError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon Party progression',
      );
    }

    /*
     * ------------------------------------------------------
     * 6. RAM SECOND
     * ------------------------------------------------------
     */

    const automaticPokemonById = new Map(
      planned.map((entry) => [
        entry.pokemon.instanceId,
        entry.automaticPokemon,
      ]),
    );

    const updatedParty = {
      pokemon: trainerState.party.pokemon.map(
        (pokemon) => automaticPokemonById.get(pokemon.instanceId) ?? pokemon,
      ),
    };

    const updatedTrainerState = this.trainerStateStore.setParty(
      trainerId,
      updatedParty,
    );

    /*
     * ------------------------------------------------------
     * 7. Pending cache AFTER DB + TrainerState
     * ------------------------------------------------------
     */

    for (const entry of planned) {
      if (entry.pendingMoveLearning) {
        this.pendingStore.set({
          trainerId,
          pokemonInstanceId: entry.pokemon.instanceId,
          candidate: entry.pendingMoveLearning.candidate,
          remainingCandidates: entry.pendingMoveLearning.remainingCandidates,
          revision: 0,
        });
      }

      if (entry.pendingEvolution) {
        this.pendingEvolutionStore.set({
          trainerId,
          pokemonInstanceId: entry.pokemon.instanceId,
          sourceSpeciesId: entry.pendingEvolution.sourceSpeciesId,
          sourceFormId: entry.pendingEvolution.sourceFormId,
          targetSpeciesId: entry.pendingEvolution.targetSpeciesId,
          targetFormId: entry.pendingEvolution.targetFormId,
          triggerLevel: entry.pendingEvolution.triggerLevel,
          revision: 0,
        });
      }
    }

    return {
      trainerState: updatedTrainerState,
      progressions: planned.map((entry) => ({
        pokemonInstanceId: entry.pokemon.instanceId,
        gainedExperience: entry.reward.gainedExperience,
        progression: entry.progression,
        pendingEvolution: entry.pendingEvolution
          ? {
              trainerId,
              pokemonInstanceId: entry.pokemon.instanceId,
              ...entry.pendingEvolution,
              revision: 0,
            }
          : null,
      })),
    };
  }
}
