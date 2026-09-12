import { Injectable } from '@nestjs/common';

import type { PokemonInstanceMove } from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonPendingEvolutionCreation } from '../evolution/pokemon-pending-evolution.types';

export interface PokemonPartyProgressionPendingCandidate {
  readonly moveId: number;
  readonly learnedAtLevel: number;
}

export interface PokemonPartyProgressionPendingMoveLearning {
  readonly candidate: PokemonPartyProgressionPendingCandidate;
  readonly remainingCandidates: readonly PokemonPartyProgressionPendingCandidate[];
}

export interface ApplyPokemonPartyProgressionEntry {
  readonly pokemonInstanceId: string;

  readonly expectedSpeciesId: number;
  readonly expectedFormId: number;
  readonly expectedAbilityId: number;

  readonly expectedLevel: number;
  readonly expectedExperience: number;

  readonly speciesId: number;
  readonly formId: number;
  readonly abilityId: number;

  readonly level: number;
  readonly experience: number;
  readonly currentHp: number;

  readonly moves: readonly PokemonInstanceMove[];

  readonly pendingMoveLearning: PokemonPartyProgressionPendingMoveLearning | null;

  readonly pendingEvolution: PokemonPendingEvolutionCreation | null;
}

export interface ApplyPokemonPartyProgressionInput {
  readonly trainerId: PokemonTrainerId;
  readonly entries: readonly ApplyPokemonPartyProgressionEntry[];
}

export class PokemonPartyProgressionPersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokemonPartyProgressionPersistenceConflictError';
  }
}

@Injectable()
export class PokemonPartyProgressionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applyPartyProgression(
    input: ApplyPokemonPartyProgressionInput,
  ): Promise<void> {
    const { trainerId, entries } = input;

    if (entries.length === 0) {
      return;
    }

    const instanceIds = entries.map((entry) => entry.pokemonInstanceId);

    if (new Set(instanceIds).size !== instanceIds.length) {
      throw new Error(
        'Party progression contains duplicate Pokémon instance ids',
      );
    }

    for (const entry of entries) {
      if (
        entry.pendingMoveLearning !== null &&
        entry.pendingEvolution !== null
      ) {
        throw new Error(
          [
            `Pokémon "${entry.pokemonInstanceId}"`,
            'cannot persist pending Move Learning',
            'and pending Evolution simultaneously',
          ].join(' '),
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      /*
       * --------------------------------------------------
       * 1. Existing pending workflow guard
       * --------------------------------------------------
       */
      const existingPendingMoveLearning =
        await tx.pokemonPendingMoveLearning.findFirst({
          where: {
            trainerId,
            pokemonInstanceId: {
              in: instanceIds,
            },
          },
          select: {
            pokemonInstanceId: true,
          },
        });

      if (existingPendingMoveLearning) {
        throw new PokemonPartyProgressionPersistenceConflictError(
          [
            `Pokémon "${existingPendingMoveLearning.pokemonInstanceId}"`,
            'already has pending move learning',
          ].join(' '),
        );
      }

      const existingPendingEvolution =
        await tx.pokemonPendingEvolution.findFirst({
          where: {
            trainerId,
            pokemonInstanceId: {
              in: instanceIds,
            },
          },
          select: {
            pokemonInstanceId: true,
          },
        });

      if (existingPendingEvolution) {
        throw new PokemonPartyProgressionPersistenceConflictError(
          [
            `Pokémon "${existingPendingEvolution.pokemonInstanceId}"`,
            'already has pending evolution',
          ].join(' '),
        );
      }

      /*
       * --------------------------------------------------
       * 2. Persist EVERY Pokémon inside this transaction
       * --------------------------------------------------
       */

      for (const entry of entries) {
        const updated = await tx.pokemonInstance.updateMany({
          where: {
            id: entry.pokemonInstanceId,
            trainerId,
            partyPosition: {
              not: null,
            },
            speciesId: entry.expectedSpeciesId,
            formId: entry.expectedFormId,
            abilityId: entry.expectedAbilityId,
            level: entry.expectedLevel,
            experience: entry.expectedExperience,
          },

          data: {
            speciesId: entry.speciesId,
            formId: entry.formId,
            abilityId: entry.abilityId,
            level: entry.level,
            experience: entry.experience,
            currentHp: entry.currentHp,
          },
        });

        if (updated.count !== 1) {
          throw new PokemonPartyProgressionPersistenceConflictError(
            [
              'Failed optimistic progression update for',
              `Pokémon "${entry.pokemonInstanceId}"`,
              `of trainer "${trainerId}"`,
            ].join(' '),
          );
        }

        /* Move list belongs to the automatic state generated by planPokemonProgression() */
        await tx.pokemonInstanceMove.deleteMany({
          where: {
            pokemonInstanceId: entry.pokemonInstanceId,
          },
        });

        if (entry.moves.length > 0) {
          await tx.pokemonInstanceMove.createMany({
            data: entry.moves.map((move, slot) => ({
              pokemonInstanceId: entry.pokemonInstanceId,
              slot,
              moveId: move.moveId,
              currentPp: move.currentPp,
            })),
          });
        }

        if (entry.pendingMoveLearning && entry.pendingEvolution) {
          throw new Error(
            [
              `Pokémon "${entry.pokemonInstanceId}"`,
              'cannot create pending Move Learning',
              'and pending Evolution simultaneously',
            ].join(' '),
          );
        }

        /*
         * A Pokémon may independently require
         * move-learning after receiving Battle EXP.
         *
         * Multiple Party Pokémon may therefore each
         * have their own pending row.
         */
        if (entry.pendingMoveLearning) {
          const pending = entry.pendingMoveLearning;

          await tx.pokemonPendingMoveLearning.create({
            data: {
              trainerId,
              pokemonInstanceId: entry.pokemonInstanceId,
              candidateMoveId: pending.candidate.moveId,
              candidateLearnedAtLevel: pending.candidate.learnedAtLevel,
              remainingCandidates: pending.remainingCandidates.map(
                (candidate) => ({
                  moveId: candidate.moveId,
                  learnedAtLevel: candidate.learnedAtLevel,
                }),
              ),
              revision: 0,
            },
          });
        }

        if (entry.pendingEvolution) {
          const pending = entry.pendingEvolution;

          await tx.pokemonPendingEvolution.create({
            data: {
              trainerId,
              pokemonInstanceId: entry.pokemonInstanceId,
              sourceSpeciesId: pending.sourceSpeciesId,
              sourceFormId: pending.sourceFormId,
              targetSpeciesId: pending.targetSpeciesId,
              targetFormId: pending.targetFormId,
              triggerLevel: pending.triggerLevel,
              revision: 0,
            },
          });
        }
      }
    });
  }
}
