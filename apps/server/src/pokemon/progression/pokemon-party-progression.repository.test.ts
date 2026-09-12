import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PrismaService } from '../../database/prisma.service';

import { PokemonPartyProgressionRepository } from './pokemon-party-progression.repository';

describe('PokemonPartyProgressionRepository', () => {
  it('persists pending Evolution inside the same Party progression transaction', async () => {
    const trainerId = 'trainer-a' as PokemonTrainerId;

    const findPendingMoveLearning = vi.fn(() => Promise.resolve(null));

    const findPendingEvolution = vi.fn(() => Promise.resolve(null));

    const updatePokemon = vi.fn(() =>
      Promise.resolve({
        count: 1,
      }),
    );

    const deleteMoves = vi.fn(() =>
      Promise.resolve({
        count: 0,
      }),
    );

    const createMoves = vi.fn(() =>
      Promise.resolve({
        count: 0,
      }),
    );

    const createPendingMoveLearning = vi.fn(() => Promise.resolve({}));

    const createPendingEvolution = vi.fn(() => Promise.resolve({}));

    const tx = {
      pokemonPendingMoveLearning: {
        findFirst: findPendingMoveLearning,

        create: createPendingMoveLearning,
      },

      pokemonPendingEvolution: {
        findFirst: findPendingEvolution,

        create: createPendingEvolution,
      },

      pokemonInstance: {
        updateMany: updatePokemon,
      },

      pokemonInstanceMove: {
        deleteMany: deleteMoves,

        createMany: createMoves,
      },
    };

    const transaction = vi.fn(
      (operation: (transactionClient: typeof tx) => Promise<void>) =>
        operation(tx),
    );

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaService;

    const repository = new PokemonPartyProgressionRepository(prisma);

    await repository.applyPartyProgression({
      trainerId,

      entries: [
        {
          pokemonInstanceId: 'pokemon-a',

          expectedSpeciesId: 1,

          expectedFormId: 1,

          expectedAbilityId: 65,

          expectedLevel: 15,

          expectedExperience: 3000,

          speciesId: 1,

          formId: 1,

          abilityId: 65,

          level: 16,

          experience: 3500,

          currentHp: 40,

          moves: [],

          pendingMoveLearning: null,

          pendingEvolution: {
            sourceSpeciesId: 1,

            sourceFormId: 1,

            targetSpeciesId: 2,

            targetFormId: 2,

            triggerLevel: 16,
          },
        },
      ],
    });

    expect(createPendingEvolution).toHaveBeenCalledTimes(1);

    expect(createPendingEvolution).toHaveBeenCalledWith({
      data: {
        trainerId,

        pokemonInstanceId: 'pokemon-a',

        sourceSpeciesId: 1,

        sourceFormId: 1,

        targetSpeciesId: 2,

        targetFormId: 2,

        triggerLevel: 16,

        revision: 0,
      },
    });

    expect(createPendingMoveLearning).not.toHaveBeenCalled();
    expect(findPendingEvolution).toHaveBeenCalledTimes(1);
  });
});
