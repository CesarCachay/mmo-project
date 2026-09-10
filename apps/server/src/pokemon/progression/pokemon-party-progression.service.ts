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

      return {
        reward,
        pokemon,
        progression,
        automaticPokemon,
        pendingMoveLearning,
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
          expectedLevel: entry.pokemon.level,
          expectedExperience: entry.pokemon.experience,
          level: entry.automaticPokemon.level,
          experience: entry.automaticPokemon.experience,
          currentHp: entry.automaticPokemon.currentHp,
          moves: entry.automaticPokemon.moves,
          pendingMoveLearning: entry.pendingMoveLearning,
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
      if (!entry.pendingMoveLearning) {
        continue;
      }

      this.pendingStore.set({
        trainerId,
        pokemonInstanceId: entry.pokemon.instanceId,
        candidate: entry.pendingMoveLearning.candidate,
        remainingCandidates: entry.pendingMoveLearning.remainingCandidates,
        revision: 0,
      });
    }

    return {
      trainerState: updatedTrainerState,
      progressions: planned.map((entry) => ({
        pokemonInstanceId: entry.pokemon.instanceId,
        gainedExperience: entry.reward.gainedExperience,
        progression: entry.progression,
      })),
    };
  }
}
