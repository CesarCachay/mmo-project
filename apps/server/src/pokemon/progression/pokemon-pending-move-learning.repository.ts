import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type {
  PokemonPendingMoveLearningCandidate,
  PokemonPendingMoveLearningState,
} from './pokemon-pending-move-learning.types';

import type { PokemonInstanceMove } from '@cesar-mmo/shared';

export class PokemonPendingMoveLearningPersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokemonPendingMoveLearningPersistenceConflictError';
  }
}

export interface ApplyPokemonMoveLearningDecisionPersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;

  /*
   * Optimistic Pokémon-state guards
   */
  readonly expectedSpeciesId: number;
  readonly expectedFormId: number;
  readonly expectedAbilityId: number;
  readonly expectedCurrentHp: number;

  readonly expectedLevel: number;
  readonly expectedExperience: number;

  /*
   * Pending workflow concurrency guard
   */
  readonly expectedRevision: number;

  /*
   * Final authoritative Pokémon state.
   *
   * These values remain unchanged while another
   * move decision exists, and become the evolved
   * values after the final decision when eligible.
   */
  readonly speciesId: number;
  readonly formId: number;
  readonly abilityId: number;
  readonly currentHp: number;

  readonly moves: readonly PokemonInstanceMove[];

  readonly nextPending: {
    readonly candidate: PokemonPendingMoveLearningCandidate;

    readonly remainingCandidates: readonly PokemonPendingMoveLearningCandidate[];
  } | null;
}

@Injectable()
export class PokemonPendingMoveLearningRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByPokemonInstanceId(
    trainerId: PokemonTrainerId,

    pokemonInstanceId: string,
  ): Promise<PokemonPendingMoveLearningState | undefined> {
    const record = await this.prisma.pokemonPendingMoveLearning.findUnique({
      where: {
        pokemonInstanceId,
      },
    });

    if (!record || record.trainerId !== trainerId) {
      return undefined;
    }

    return {
      trainerId: record.trainerId,
      pokemonInstanceId: record.pokemonInstanceId,
      candidate: {
        moveId: record.candidateMoveId,
        learnedAtLevel: record.candidateLearnedAtLevel,
      },
      remainingCandidates: parseCandidateArray(record.remainingCandidates),
      revision: record.revision,
    };
  }

  public async applyDecision(
    input: ApplyPokemonMoveLearningDecisionPersistenceInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      /* 1. Validate the pending workflow revision */
      const pending = await tx.pokemonPendingMoveLearning.findUnique({
        where: {
          pokemonInstanceId: input.pokemonInstanceId,
        },

        select: {
          trainerId: true,
          revision: true,
        },
      });

      if (
        !pending ||
        pending.trainerId !== input.trainerId ||
        pending.revision !== input.expectedRevision
      ) {
        throw new PokemonPendingMoveLearningPersistenceConflictError(
          [
            `Pending move-learning state changed for Pokémon "${input.pokemonInstanceId}"`,
            `expectedRevision=${input.expectedRevision}`,
          ].join(', '),
        );
      }

      /*
       * --------------------------------------------------
       * 2. Apply the final Pokémon state atomically
       * --------------------------------------------------
       */
      const updatedPokemon = await tx.pokemonInstance.updateMany({
        where: {
          id: input.pokemonInstanceId,
          trainerId: input.trainerId,
          partyPosition: {
            not: null,
          },
          speciesId: input.expectedSpeciesId,
          formId: input.expectedFormId,
          abilityId: input.expectedAbilityId,
          currentHp: input.expectedCurrentHp,
          level: input.expectedLevel,
          experience: input.expectedExperience,
        },

        data: {
          speciesId: input.speciesId,
          formId: input.formId,
          abilityId: input.abilityId,
          currentHp: input.currentHp,
        },
      });

      if (updatedPokemon.count !== 1) {
        throw new PokemonPendingMoveLearningPersistenceConflictError(
          [
            `Pokémon "${input.pokemonInstanceId}" changed`,
            'before the pending move-learning decision',
            'and deferred evolution could be persisted',
          ].join(' '),
        );
      }

      /* 3. Persist final moves reached after: current decision + any automatic continuation */
      await tx.pokemonInstanceMove.deleteMany({
        where: {
          pokemonInstanceId: input.pokemonInstanceId,
        },
      });

      if (input.moves.length > 0) {
        await tx.pokemonInstanceMove.createMany({
          data: input.moves.map((move, slot) => ({
            pokemonInstanceId: input.pokemonInstanceId,
            slot,
            moveId: move.moveId,
            currentPp: move.currentPp,
          })),
        });
      }

      /* 4. Either advance the pending workflow or finish it */
      if (input.nextPending) {
        const updated = await tx.pokemonPendingMoveLearning.updateMany({
          where: {
            pokemonInstanceId: input.pokemonInstanceId,
            trainerId: input.trainerId,
            revision: input.expectedRevision,
          },

          data: {
            candidateMoveId: input.nextPending.candidate.moveId,
            candidateLearnedAtLevel: input.nextPending.candidate.learnedAtLevel,
            remainingCandidates: input.nextPending.remainingCandidates.map(
              (candidate) => ({
                moveId: candidate.moveId,

                learnedAtLevel: candidate.learnedAtLevel,
              }),
            ),
            revision: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new PokemonPendingMoveLearningPersistenceConflictError(
            `Pending move-learning state changed for Pokémon "${input.pokemonInstanceId}"`,
          );
        }
        return;
      }

      const deleted = await tx.pokemonPendingMoveLearning.deleteMany({
        where: {
          pokemonInstanceId: input.pokemonInstanceId,
          trainerId: input.trainerId,
          revision: input.expectedRevision,
        },
      });

      if (deleted.count !== 1) {
        throw new PokemonPendingMoveLearningPersistenceConflictError(
          `Pending move-learning state changed for Pokémon "${input.pokemonInstanceId}"`,
        );
      }
    });
  }
}

function parseCandidateArray(
  value: unknown,
): PokemonPendingMoveLearningCandidate[] {
  if (!Array.isArray(value)) {
    throw new Error(
      'Persisted pending move-learning candidates must be an array',
    );
  }

  return value.map((candidate, index) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      throw new Error(
        `Invalid pending move-learning candidate at index ${index}`,
      );
    }

    const record = candidate as Record<string, unknown>;
    const moveId = record.moveId;
    const learnedAtLevel = record.learnedAtLevel;

    if (!Number.isInteger(moveId) || Number(moveId) <= 0) {
      throw new Error(`Invalid persisted pending moveId "${String(moveId)}"`);
    }

    if (!Number.isInteger(learnedAtLevel) || Number(learnedAtLevel) <= 0) {
      throw new Error(
        `Invalid persisted learnedAtLevel "${String(learnedAtLevel)}"`,
      );
    }

    return {
      moveId: Number(moveId),
      learnedAtLevel: Number(learnedAtLevel),
    };
  });
}
