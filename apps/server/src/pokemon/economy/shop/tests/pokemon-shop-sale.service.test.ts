import { describe, expect, it, vi } from 'vitest';

import {
  POKEMON_MAX_MONEY,
  createPokemonInventory,
} from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import { PokemonShopPurchaseOperationQueue } from '../pokemon-shop-purchase-operation.queue';
import {
  PokemonShopInsufficientInventoryPersistenceError,
  type PokemonShopSaleRepository,
  PokemonShopWalletLimitPersistenceError,
} from '../pokemon-shop-sale.repository';
import {
  PokemonShopSaleError,
  PokemonShopSaleService,
} from '../pokemon-shop-sale.service';

const TRAINER_ID =
  '33333333-3333-4333-8333-333333333333' as PokemonTrainerId;
const REQUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createHarness(input?: {
  readonly money?: number;
  readonly potionQuantity?: number;
  readonly repositoryResult?: {
    readonly replayed: boolean;
    readonly unitPrice: number;
    readonly totalPrice: number;
    readonly money: number;
    readonly inventoryQuantity: number;
  };
}) {
  const money = input?.money ?? 3_000;
  const potionQuantity = input?.potionQuantity ?? 5;
  const result = input?.repositoryResult ?? {
    replayed: false,
    unitPrice: 150,
    totalPrice: 300,
    money: money + 300,
    inventoryQuantity: 3,
  };
  const trainerStateStore = new PokemonTrainerStateStore();
  trainerStateStore.create(
    TRAINER_ID,
    undefined,
    createPokemonInventory(
      potionQuantity > 0
        ? [{ itemId: 'potion', quantity: potionQuantity }]
        : [],
    ),
    [],
    money,
  );

  const applySale = vi.fn().mockResolvedValue({
    ...result,
    inventory: createPokemonInventory(
      result.inventoryQuantity > 0
        ? [{ itemId: 'potion', quantity: result.inventoryQuantity }]
        : [],
    ),
  });

  const repository = {
    applySale,
  } as unknown as PokemonShopSaleRepository;

  const service = new PokemonShopSaleService(
    trainerStateStore,
    repository,
    new PokemonShopPurchaseOperationQueue(),
  );

  return {
    service,
    trainerStateStore,
    applySale,
  };
}

describe('PokemonShopSaleService', () => {
  it('persists first and then replaces wallet + inventory in TrainerState', async () => {
    const harness = createHarness();

    const result = await harness.service.sell({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
    });

    expect(harness.applySale).toHaveBeenCalledWith({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
      unitPrice: 150,
      totalPrice: 300,
    });
    expect(result.quote).toMatchObject({
      unitPrice: 150,
      totalPrice: 300,
    });
    expect(result.replayed).toBe(false);
    expect(result.trainerState.money).toBe(3_300);
    expect(result.trainerState.inventory.items).toEqual([
      { itemId: 'potion', quantity: 3 },
    ]);
  });

  it('maps the authoritative inventory guard', async () => {
    const harness = createHarness({ potionQuantity: 1 });
    harness.applySale.mockRejectedValueOnce(
      new PokemonShopInsufficientInventoryPersistenceError(),
    );

    await expect(
      harness.service.sell({
        trainerId: TRAINER_ID,
        requestId: REQUEST_ID,
        catalogId: 'standard-poke-shop-v1',
        itemId: 'potion',
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
    } satisfies Partial<PokemonShopSaleError>);
  });

  it('maps the authoritative wallet-cap guard', async () => {
    const harness = createHarness({
      money: POKEMON_MAX_MONEY - 100,
      potionQuantity: 1,
    });
    harness.applySale.mockRejectedValueOnce(
      new PokemonShopWalletLimitPersistenceError(),
    );

    await expect(
      harness.service.sell({
        trainerId: TRAINER_ID,
        requestId: REQUEST_ID,
        catalogId: 'standard-poke-shop-v1',
        itemId: 'potion',
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      code: 'WALLET_LIMIT_REACHED',
    } satisfies Partial<PokemonShopSaleError>);
  });

  it('accepts an idempotent replay even if the RAM snapshot no longer satisfies the original sale', async () => {
    const harness = createHarness({
      money: POKEMON_MAX_MONEY,
      potionQuantity: 0,
      repositoryResult: {
        replayed: true,
        unitPrice: 150,
        totalPrice: 300,
        money: POKEMON_MAX_MONEY,
        inventoryQuantity: 0,
      },
    });

    const result = await harness.service.sell({
      trainerId: TRAINER_ID,
      requestId: REQUEST_ID,
      catalogId: 'standard-poke-shop-v1',
      itemId: 'potion',
      quantity: 2,
    });

    expect(result.replayed).toBe(true);
    expect(result.trainerState.money).toBe(POKEMON_MAX_MONEY);
    expect(result.trainerState.inventory.items).toEqual([]);
  });
});
