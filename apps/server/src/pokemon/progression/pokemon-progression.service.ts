import { Injectable } from '@nestjs/common';

import { getPokemonSpecies, planPokemonProgression } from '@cesar-mmo/shared';

import type {
  PokemonProgressionPlan,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import {
  PokemonProgressionPersistenceConflictError,
  PokemonProgressionRepository,
} from './pokemon-progression.repository';

import { PokemonProgressionOperationQueue } from './pokemon-progression-operation.queue';

import { PokemonPendingMoveLearningRepository } from './pokemon-pending-move-learning.repository';

import { PokemonPendingMoveLearningStore } from './pokemon-pending-move-learning.store';

import { toPendingMoveLearningCandidate } from './pokemon-pending-move-learning.types';

export type PokemonProgressionErrorCode =
  | 'TRAINER_STATE_NOT_FOUND'
  | 'POKEMON_NOT_IN_PARTY'
  | 'SPECIES_NOT_FOUND'
  | 'PENDING_MOVE_LEARNING'
  | 'PERSISTENCE_CONFLICT'
  | 'PERSISTENCE_FAILED';

export class PokemonProgressionError extends Error {
  constructor(
    public readonly code: PokemonProgressionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonProgressionError';
  }
}

export interface ApplyPokemonExperienceInput {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;
  readonly gainedExperience: number;
}

export interface ApplyPokemonExperienceResult {
  readonly trainerState: PokemonTrainerState;
  readonly progression: PokemonProgressionPlan;
}

@Injectable()
export class PokemonProgressionService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly repository: PokemonProgressionRepository,
    private readonly operationQueue: PokemonProgressionOperationQueue,
    private readonly pendingRepository: PokemonPendingMoveLearningRepository,
    private readonly pendingStore: PokemonPendingMoveLearningStore,
  ) {}

  public applyExperience(
    input: ApplyPokemonExperienceInput,
  ): Promise<ApplyPokemonExperienceResult> {
    return this.operationQueue.enqueue(input.trainerId, () =>
      this.executeApplyExperience(input),
    );
  }

  private async executeApplyExperience(
    input: ApplyPokemonExperienceInput,
  ): Promise<ApplyPokemonExperienceResult> {
    const { trainerId, pokemonInstanceId, gainedExperience } = input;

    /* 1. Authoritative runtime state */
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonProgressionError(
        'TRAINER_STATE_NOT_FOUND',
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /*
     * 2. Progression V1 targets active Party.
     * This naturally matches: Battle EXP and Rare Candy from normal Inventory
     */
    const pokemon = trainerState.party.pokemon.find(
      (entry) => entry.instanceId === pokemonInstanceId,
    );

    if (!pokemon) {
      throw new PokemonProgressionError(
        'POKEMON_NOT_IN_PARTY',
        `Pokémon "${pokemonInstanceId}" is not in trainer "${trainerId}" Party`,
      );
    }

    let pending = this.pendingStore.getByPokemonInstanceId(pokemonInstanceId);

    if (!pending) {
      pending = await this.pendingRepository.findByPokemonInstanceId(
        trainerId,
        pokemonInstanceId,
      );

      if (pending) {
        this.pendingStore.set(pending);
      }
    }

    if (pending) {
      throw new PokemonProgressionError(
        'PENDING_MOVE_LEARNING',

        [
          `Pokémon "${pokemonInstanceId}"`,
          'must resolve its pending move-learning decision',
          'before gaining more experience',
        ].join(' '),
      );
    }

    /* 3. Static species data */
    const species = getPokemonSpecies(pokemon.speciesId);

    if (!species) {
      throw new PokemonProgressionError(
        'SPECIES_NOT_FOUND',
        `Pokémon species "${pokemon.speciesId}" not found`,
      );
    }

    /* 4. Pure domain calculation. No DB. No RAM mutation */
    const progression = planPokemonProgression({
      pokemon,
      growthRate: species.growthRate,
      gainedExperience,
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

    /* 5. PostgreSQL FIRST */
    try {
      await this.repository.applyProgression({
        trainerId,
        pokemonInstanceId,
        expectedLevel: pokemon.level,
        expectedExperience: pokemon.experience,
        level: automaticPokemon.level,
        experience: automaticPokemon.experience,
        currentHp: automaticPokemon.currentHp,
        moves: automaticPokemon.moves,
        pendingMoveLearning,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonProgressionPersistenceConflictError) {
        throw new PokemonProgressionError(
          'PERSISTENCE_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonProgression] persistence failed', {
        trainerId,
        pokemonInstanceId,
        gainedExperience,
        error,
      });

      throw new PokemonProgressionError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon progression',
      );
    }

    /* 6. RAM SECOND */
    const updatedParty = {
      pokemon: trainerState.party.pokemon.map((entry) =>
        entry.instanceId === pokemonInstanceId ? automaticPokemon : entry,
      ),
    };

    const updatedTrainerState = this.trainerStateStore.setParty(
      trainerId,
      updatedParty,
    );

    if (pendingMoveLearning) {
      this.pendingStore.set({
        trainerId,
        pokemonInstanceId,
        candidate: pendingMoveLearning.candidate,
        remainingCandidates: pendingMoveLearning.remainingCandidates,
        revision: 0,
      });
    }

    return {
      trainerState: updatedTrainerState,
      progression,
    };
  }
}
