import { Injectable } from '@nestjs/common';

import type { PokemonInstanceMove } from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonPendingMoveLearningCandidate } from './pokemon-pending-move-learning.types';

export class PokemonProgressionPersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokemonProgressionPersistenceConflictError';
  }
}

export interface ApplyPokemonProgressionInput {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;
  /* Optimistic concurrency guards */
  readonly expectedSpeciesId: number;
  readonly expectedFormId: number;
  readonly expectedAbilityId: number;

  readonly expectedLevel: number;
  readonly expectedExperience: number;

  /* New authoritative state */
  readonly speciesId: number;
  readonly formId: number;
  readonly abilityId: number;

  readonly level: number;
  readonly experience: number;
  readonly currentHp: number;
  readonly moves: readonly PokemonInstanceMove[];
  readonly pendingMoveLearning: {
    readonly candidate: PokemonPendingMoveLearningCandidate;
    readonly remainingCandidates: readonly PokemonPendingMoveLearningCandidate[];
  } | null;
  readonly pendingEvolution: {
    readonly sourceSpeciesId: number;
    readonly sourceFormId: number;
    readonly targetSpeciesId: number;
    readonly targetFormId: number;
    readonly triggerLevel: number;
  } | null;
}

@Injectable()
export class PokemonProgressionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applyProgression(
    input: ApplyPokemonProgressionInput,
  ): Promise<void> {
    const {
      trainerId,
      pokemonInstanceId,
      expectedSpeciesId,
      expectedFormId,
      expectedAbilityId,
      expectedLevel,
      expectedExperience,
      speciesId,
      formId,
      abilityId,
      level,
      experience,
      currentHp,
      moves,
    } = input;

    await this.prisma.$transaction(async (tx) => {
      const existingPending = await tx.pokemonPendingMoveLearning.findUnique({
        where: {
          pokemonInstanceId,
        },
        select: {
          id: true,
        },
      });

      if (existingPending) {
        throw new PokemonProgressionPersistenceConflictError(
          `Pokémon "${pokemonInstanceId}" already has a pending move-learning decision`,
        );
      }

      /* 1. Update the Pokémon itself */
      const updated = await tx.pokemonInstance.updateMany({
        where: {
          id: pokemonInstanceId,
          trainerId,

          partyPosition: {
            not: null,
          },

          speciesId: expectedSpeciesId,
          formId: expectedFormId,
          abilityId: expectedAbilityId,

          level: expectedLevel,
          experience: expectedExperience,
        },
        data: {
          speciesId,
          formId,
          abilityId,

          level,
          experience,
          currentHp,
        },
      });

      if (updated.count !== 1) {
        throw new PokemonProgressionPersistenceConflictError(
          [
            `Could not persist progression for Pokémon "${pokemonInstanceId}"`,
            `trainer="${trainerId}"`,
            `expectedLevel=${expectedLevel}`,
            `expectedExperience=${expectedExperience}`,
          ].join(', '),
        );
      }

      /* 2. Move set belongs to the same atomic transition. This includes auto-learned moves */
      await tx.pokemonInstanceMove.deleteMany({
        where: {
          pokemonInstanceId,
        },
      });

      if (moves.length > 0) {
        await tx.pokemonInstanceMove.createMany({
          data: moves.map((move, slot) => ({
            pokemonInstanceId,
            slot,
            moveId: move.moveId,
            currentPp: move.currentPp,
          })),
        });
      }

      const existingEvolution = await tx.pokemonPendingEvolution.findUnique({
        where: {
          pokemonInstanceId,
        },

        select: {
          id: true,
        },
      });

      if (existingEvolution) {
        throw new PokemonProgressionPersistenceConflictError(
          `Pokémon "${pokemonInstanceId}" already has a pending evolution`,
        );
      }

      if (input.pendingMoveLearning && input.pendingEvolution) {
        throw new Error(
          'Pokémon progression cannot create move-learning and evolution pending workflows simultaneously',
        );
      }

      if (input.pendingEvolution) {
        await tx.pokemonPendingEvolution.create({
          data: {
            trainerId,
            pokemonInstanceId,
            sourceSpeciesId: input.pendingEvolution.sourceSpeciesId,
            sourceFormId: input.pendingEvolution.sourceFormId,
            targetSpeciesId: input.pendingEvolution.targetSpeciesId,
            targetFormId: input.pendingEvolution.targetFormId,
            triggerLevel: input.pendingEvolution.triggerLevel,
            revision: 0,
          },
        });
      }

      if (input.pendingMoveLearning) {
        await tx.pokemonPendingMoveLearning.create({
          data: {
            trainerId,
            pokemonInstanceId,
            candidateMoveId: input.pendingMoveLearning.candidate.moveId,
            candidateLearnedAtLevel:
              input.pendingMoveLearning.candidate.learnedAtLevel,
            remainingCandidates:
              input.pendingMoveLearning.remainingCandidates.map(
                (candidate) => ({
                  moveId: candidate.moveId,
                  learnedAtLevel: candidate.learnedAtLevel,
                }),
              ),
            revision: 0,
          },
        });
      }
    });
  }
}
