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
  readonly expectedLevel: number;
  readonly expectedExperience: number;
  /* New authoritative state */
  readonly level: number;
  readonly experience: number;
  readonly currentHp: number;
  readonly moves: readonly PokemonInstanceMove[];
  readonly pendingMoveLearning: {
    readonly candidate: PokemonPendingMoveLearningCandidate;
    readonly remainingCandidates: readonly PokemonPendingMoveLearningCandidate[];
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
      expectedLevel,
      expectedExperience,
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
          level: expectedLevel,
          experience: expectedExperience,
        },
        data: {
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
