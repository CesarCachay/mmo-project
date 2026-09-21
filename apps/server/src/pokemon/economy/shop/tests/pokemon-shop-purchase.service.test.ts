import { describe, expect, it, vi } from 'vitest';

import { createPokemonInventory } from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import { PokemonShopPurchaseOperationQueue } from '../pokemon-shop-purchase-operation.queue';
import {
  PokemonShopInsufficientFundsPersistenceError,
  type PokemonShopPurchaseRepository,
} from '../pokemon-shop-purchase.repository';
import {
  PokemonShopPurchaseError,
  PokemonShopPurchaseService,
} from '../pokemon-shop-purchase.service';

const TRAINER_ID =
  '22222222-2222-4222-8222-222222222222' as PokemonTrainerId;
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createHarness(input?: {
  readonly money?: number;
  readonly repositoryResult?: {
    readonly replayed: boolean;
    readonly unitPrice: number;
    readonly totalPrice: number;
    readonly money: number;
    readonly inventoryQuantity: number;
  };
}) {
  const money = input?.money ?? 3_000;
  const result = input?.repositoryResult ?? {
    replayed: false,
    unitPrice: 300,
    totalPrice: 600,
    money: 2_400,
    inventoryQuantity: 3,
  };

  const trainerStateStore = new PokemonTrainerStateStore();
  trainerStateStore.create(
    TRAINER_ID,
    undefined,
    createPokemonInventory([{ itemId: 'potion', quantity: 1 }]),
    [],
    money,
  );

  const applyPurchase = vi.fn().mockResolvedValue({
    ...result,
    inventory: createPokemonInventory([
      { itemId: 'potion', quantity: result.inventoryQuantity },
    ]),
  });

  const repository = {
    applyPurchase,
  } as unknown as PokemonShopPurchaseRepository;

  const service = new PokemonShopPurchaseService(
    trainerStateStore,
    repository,
    new PokemonShopPurchaseOperationQueue(),
  );

  return {
    service,
    trainerStateStore,
    applyPurchase,
  };
}

describe('PokemonShopPurchaseService', () => {
  it('persists first and then replaces wallet + inventory in TrainerState', async () => {
    const harness = createHarness();

    const result = await harness.service.purchase({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
    });

    expect(harness.applyPurchase).toHaveBeenCalledWith({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
      unitPrice: 300,
      totalPrice: 600,
    });
    expect(result.quote).toMatchObject({
      unitPrice: 300,
      totalPrice: 600,
    });
    expect(result.replayed).toBe(false);
    expect(result.trainerState.money).toBe(2_400);
    expect(result.trainerState.inventory.items).toEqual([
      { itemId: 'potion', quantity: 3 },
    ]);
    expect(harness.trainerStateStore.get(TRAINER_ID)).toEqual(
      result.trainerState,
    );
  });

  it('rejects an item that is not stocked without touching persistence', async () => {
    const harness = createHarness();

    await expect(
      harness.service.purchase({
        trainerId: TRAINER_ID,
        requestId: REQUEST_ID,
        catalogId: 'standard-poke-shop-v1',
        itemId: 'hyper-potion',
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      code: 'ITEM_NOT_AVAILABLE',
    } satisfies Partial<PokemonShopPurchaseError>);

    expect(harness.applyPurchase).not.toHaveBeenCalled();
  });

  it('maps the authoritative PostgreSQL funds guard', async () => {
    const harness = createHarness({ money: 100 });
    harness.applyPurchase.mockRejectedValueOnce(
      new PokemonShopInsufficientFundsPersistenceError(),
    );

    await expect(
      harness.service.purchase({
        trainerId: TRAINER_ID,
        requestId: REQUEST_ID,
        catalogId: 'standard-poke-shop-v1',
        itemId: 'potion',
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    } satisfies Partial<PokemonShopPurchaseError>);

    expect(harness.applyPurchase).toHaveBeenCalledOnce();
  });

  it('accepts an idempotent replay even when the RAM wallet is now below the original price', async () => {
    const harness = createHarness({
      money: 100,
      repositoryResult: {
        replayed: true,
        unitPrice: 300,
        totalPrice: 600,
        money: 100,
        inventoryQuantity: 3,
      },
    });

    const result = await harness.service.purchase({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
    });

    expect(result.replayed).toBe(true);
    expect(result.trainerState.money).toBe(100);
    expect(result.trainerState.inventory.items).toEqual([
      { itemId: 'potion', quantity: 3 },
    ]);
  });
});
