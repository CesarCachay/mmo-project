import { describe, expect, it, vi } from 'vitest';

import type { PokemonParty } from '@cesar-mmo/shared';

import type { PrismaService } from '../../../database/prisma.service';

import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

import {
  PokemonCenterHealingPersistenceConflictError,
  PokemonCenterHealingRepository,
} from '../pokemon-center-healing.repository';

const trainerId = 'trainer-a' as PokemonTrainerId;

const expectedParty: PokemonParty = {
  pokemon: [
    {
      instanceId: 'pokemon-a',
      speciesId: 4,
      formId: 4,
      level: 12,
      experience: 1728,
      currentHp: 7,
      abilityId: 66,

      moves: [
        {
          moveId: 10,
          currentPp: 4,
        },
        {
          moveId: 52,
          currentPp: 2,
        },
      ],
    },

    {
      instanceId: 'pokemon-b',
      speciesId: 7,
      formId: 7,
      level: 10,
      experience: 1000,
      currentHp: 0,
      abilityId: 67,

      moves: [
        {
          moveId: 33,
          currentPp: 11,
        },
      ],
    },
  ],
};

const healedParty: PokemonParty = {
  pokemon: [
    {
      ...expectedParty.pokemon[0]!,
      currentHp: 34,

      moves: [
        {
          moveId: 10,
          currentPp: 35,
        },
        {
          moveId: 52,
          currentPp: 25,
        },
      ],
    },

    {
      ...expectedParty.pokemon[1]!,
      currentHp: 31,

      moves: [
        {
          moveId: 33,
          currentPp: 35,
        },
      ],
    },
  ],
};

const persistedParty = [
  {
    id: 'pokemon-a',
    speciesId: 4,
    formId: 4,
    level: 12,
    currentHp: 7,

    moves: [
      {
        slot: 0,
        moveId: 10,
        currentPp: 4,
      },
      {
        slot: 1,
        moveId: 52,
        currentPp: 2,
      },
    ],
  },

  {
    id: 'pokemon-b',
    speciesId: 7,
    formId: 7,
    level: 10,
    currentHp: 0,

    moves: [
      {
        slot: 0,
        moveId: 33,
        currentPp: 11,
      },
    ],
  },
] as const;

interface RepositoryHarnessOptions {
  readonly persistedParty?:
    typeof persistedParty | readonly Record<string, unknown>[];

  readonly pokemonUpdateCounts?: readonly number[];
  readonly moveUpdateCounts?: readonly number[];
}

function createRepositoryHarness(options: RepositoryHarnessOptions = {}) {
  const findParty = vi.fn(() =>
    Promise.resolve(options.persistedParty ?? persistedParty),
  );

  const pokemonUpdateCounts = [...(options.pokemonUpdateCounts ?? [1, 1])];

  const moveUpdateCounts = [...(options.moveUpdateCounts ?? [1, 1, 1])];

  const updatePokemon = vi.fn(() =>
    Promise.resolve({
      count: pokemonUpdateCounts.shift() ?? 1,
    }),
  );

  const updateMove = vi.fn(() =>
    Promise.resolve({
      count: moveUpdateCounts.shift() ?? 1,
    }),
  );

  const tx = {
    pokemonInstance: {
      findMany: findParty,
      updateMany: updatePokemon,
    },

    pokemonInstanceMove: {
      updateMany: updateMove,
    },
  };

  const transaction = vi.fn(
    (operation: (transactionClient: typeof tx) => Promise<void>) =>
      operation(tx),
  );

  const prisma = {
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    repository: new PokemonCenterHealingRepository(prisma),

    transaction,
    findParty,
    updatePokemon,
    updateMove,
  };
}

describe('PokemonCenterHealingRepository', () => {
  it('persists full-Party healing by changing only currentHp and currentPp', async () => {
    const harness = createRepositoryHarness();

    await harness.repository.applyHealing({
      trainerId,
      expectedParty,
      healedParty,
    });

    expect(harness.transaction).toHaveBeenCalledTimes(1);

    expect(harness.findParty).toHaveBeenCalledWith({
      where: {
        trainerId,

        partyPosition: {
          not: null,
        },
      },

      select: {
        id: true,
        speciesId: true,
        formId: true,
        level: true,
        currentHp: true,

        moves: {
          orderBy: {
            slot: 'asc',
          },

          select: {
            slot: true,
            moveId: true,
            currentPp: true,
          },
        },
      },
    });

    expect(harness.updatePokemon).toHaveBeenCalledTimes(2);

    expect(harness.updatePokemon).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'pokemon-a',
        trainerId,

        partyPosition: {
          not: null,
        },

        speciesId: 4,
        formId: 4,
        level: 12,
        currentHp: 7,
      },

      data: {
        currentHp: 34,
      },
    });

    expect(harness.updateMove).toHaveBeenCalledTimes(3);

    expect(harness.updateMove).toHaveBeenNthCalledWith(1, {
      where: {
        pokemonInstanceId: 'pokemon-a',
        slot: 0,
        moveId: 10,
        currentPp: 4,
      },

      data: {
        currentPp: 35,
      },
    });
  });

  it('rejects healing before any write when active Party membership changed', async () => {
    const harness = createRepositoryHarness({
      persistedParty: [persistedParty[0]],
    });

    await expect(
      harness.repository.applyHealing({
        trainerId,
        expectedParty,
        healedParty,
      }),
    ).rejects.toMatchObject({
      code: 'PARTY_STATE_CHANGED',
    } satisfies Partial<PokemonCenterHealingPersistenceConflictError>);

    expect(harness.updatePokemon).not.toHaveBeenCalled();

    expect(harness.updateMove).not.toHaveBeenCalled();
  });

  it('rejects healing before any write when a persisted move slot changed', async () => {
    const stalePersistedParty = [
      {
        ...persistedParty[0],

        moves: [
          {
            slot: 0,
            moveId: 99,
            currentPp: 4,
          },

          persistedParty[0].moves[1],
        ],
      },

      persistedParty[1],
    ];

    const harness = createRepositoryHarness({
      persistedParty: stalePersistedParty,
    });

    await expect(
      harness.repository.applyHealing({
        trainerId,
        expectedParty,
        healedParty,
      }),
    ).rejects.toMatchObject({
      code: 'MOVE_STATE_CHANGED',
    } satisfies Partial<PokemonCenterHealingPersistenceConflictError>);

    expect(harness.updatePokemon).not.toHaveBeenCalled();

    expect(harness.updateMove).not.toHaveBeenCalled();
  });

  it('aborts when Pokémon HP changes after preflight and before the guarded write', async () => {
    const harness = createRepositoryHarness({
      pokemonUpdateCounts: [0],
    });

    await expect(
      harness.repository.applyHealing({
        trainerId,
        expectedParty,
        healedParty,
      }),
    ).rejects.toMatchObject({
      code: 'POKEMON_STATE_CHANGED',
    } satisfies Partial<PokemonCenterHealingPersistenceConflictError>);

    expect(harness.updatePokemon).toHaveBeenCalledTimes(1);

    expect(harness.updateMove).not.toHaveBeenCalled();
  });

  it('aborts when move PP changes after preflight and before the guarded write', async () => {
    const harness = createRepositoryHarness({
      moveUpdateCounts: [0],
    });

    await expect(
      harness.repository.applyHealing({
        trainerId,
        expectedParty,
        healedParty,
      }),
    ).rejects.toMatchObject({
      code: 'MOVE_STATE_CHANGED',
    } satisfies Partial<PokemonCenterHealingPersistenceConflictError>);

    expect(harness.updatePokemon).toHaveBeenCalledTimes(1);

    expect(harness.updateMove).toHaveBeenCalledTimes(1);
  });
});
