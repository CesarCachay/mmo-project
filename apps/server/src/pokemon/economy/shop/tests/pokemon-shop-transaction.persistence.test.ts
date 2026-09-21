import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import {
  PokemonShopTransactionRequestConflictPersistenceError,
  reservePokemonShopTransaction,
} from '../pokemon-shop-transaction.persistence';

const TRAINER_ID =
  '55555555-5555-4555-8555-555555555555' as PokemonTrainerId;
const REQUEST_ID = '66666666-6666-4666-8666-666666666666';

const input = {
  trainerId: TRAINER_ID,
  requestId: REQUEST_ID,
  operation: 'buy' as const,
  catalogId: 'standard-poke-shop-v1' as const,
  itemId: 'potion' as const,
  quantity: 2,
  unitPrice: 300,
  totalPrice: 600,
};

describe('reservePokemonShopTransaction', () => {
  it('marks a newly inserted request as non-replayed', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([
      {
        operation: 'buy',
        catalogId: 'standard-poke-shop-v1',
        itemId: 'potion',
        quantity: 2,
        unitPrice: 300,
        totalPrice: 600,
      },
    ]);

    const tx = { $queryRaw: queryRaw } as unknown as Parameters<typeof reservePokemonShopTransaction>[0];

    await expect(reservePokemonShopTransaction(tx, input)).resolves.toEqual({
      replayed: false,
      unitPrice: 300,
      totalPrice: 600,
    });
  });

  it('replays the original prices for the same durable request id', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          operation: 'buy',
          catalogId: 'standard-poke-shop-v1',
          itemId: 'potion',
          quantity: 2,
          unitPrice: 300,
          totalPrice: 600,
        },
      ]);

    const tx = { $queryRaw: queryRaw } as unknown as Parameters<typeof reservePokemonShopTransaction>[0];

    await expect(
      reservePokemonShopTransaction(tx, {
        ...input,
        unitPrice: 999,
        totalPrice: 1_998,
      }),
    ).resolves.toEqual({
      replayed: true,
      unitPrice: 300,
      totalPrice: 600,
    });
  });

  it('rejects reusing a request id for a different transaction fingerprint', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          operation: 'sell',
          catalogId: 'standard-poke-shop-v1',
          itemId: 'potion',
          quantity: 2,
          unitPrice: 150,
          totalPrice: 300,
        },
      ]);

    const tx = { $queryRaw: queryRaw } as unknown as Parameters<typeof reservePokemonShopTransaction>[0];

    await expect(
      reservePokemonShopTransaction(tx, input),
    ).rejects.toBeInstanceOf(
      PokemonShopTransactionRequestConflictPersistenceError,
    );
  });
});
