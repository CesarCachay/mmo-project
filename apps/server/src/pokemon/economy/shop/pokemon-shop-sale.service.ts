import { Injectable } from '@nestjs/common';

import {
  quotePokemonShopSale,
  type PokemonItemId,
  type PokemonShopCatalogId,
  type PokemonShopPriceQuote,
  type PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';

import { PokemonShopPurchaseOperationQueue } from './pokemon-shop-purchase-operation.queue';
import {
  PokemonShopInsufficientInventoryPersistenceError,
  PokemonShopSaleRepository,
  PokemonShopWalletLimitPersistenceError,
} from './pokemon-shop-sale.repository';
import { PokemonShopTransactionRequestConflictPersistenceError } from './pokemon-shop-transaction.persistence';

export type PokemonShopSaleErrorCode =
  | 'TRAINER_STATE_NOT_FOUND'
  | 'ITEM_NOT_SELLABLE'
  | 'INSUFFICIENT_INVENTORY'
  | 'WALLET_LIMIT_REACHED'
  | 'REQUEST_CONFLICT'
  | 'PERSISTENCE_FAILED';

export class PokemonShopSaleError extends Error {
  constructor(
    public readonly code: PokemonShopSaleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonShopSaleError';
  }
}

export interface PokemonShopSaleInput {
  readonly trainerId: PokemonTrainerId;
  readonly requestId: string;
  readonly catalogId: PokemonShopCatalogId;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
}

export interface PokemonShopSaleResult {
  readonly trainerState: PokemonTrainerState;
  readonly quote: PokemonShopPriceQuote;
  readonly inventoryQuantity: number;
  readonly replayed: boolean;
}

@Injectable()
export class PokemonShopSaleService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly repository: PokemonShopSaleRepository,
    /* Shared with purchases: BUY and SELL serialize per Trainer. */
    private readonly operationQueue: PokemonShopPurchaseOperationQueue,
  ) {}

  public sell(input: PokemonShopSaleInput): Promise<PokemonShopSaleResult> {
    return this.operationQueue.enqueue(input.trainerId, () =>
      this.executeSale(input),
    );
  }

  private async executeSale(
    input: PokemonShopSaleInput,
  ): Promise<PokemonShopSaleResult> {
    const trainerState = this.trainerStateStore.get(input.trainerId);

    if (!trainerState) {
      throw new PokemonShopSaleError(
        'TRAINER_STATE_NOT_FOUND',
        `Pokémon Trainer state not found for trainer "${input.trainerId}"`,
      );
    }

    const quote = quotePokemonShopSale(
      input.catalogId,
      input.itemId,
      input.quantity,
    );

    if (!quote) {
      throw new PokemonShopSaleError(
        'ITEM_NOT_SELLABLE',
        'That item cannot be sold at this Poké Shop.',
      );
    }

    let persisted;

    try {
      persisted = await this.repository.applySale({
        trainerId: input.trainerId,
        requestId: input.requestId,
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonShopInsufficientInventoryPersistenceError) {
        throw new PokemonShopSaleError(
          'INSUFFICIENT_INVENTORY',
          'You do not own enough of that item to sell this quantity.',
        );
      }

      if (error instanceof PokemonShopWalletLimitPersistenceError) {
        throw new PokemonShopSaleError(
          'WALLET_LIMIT_REACHED',
          'Your wallet cannot hold the proceeds of this sale.',
        );
      }

      if (error instanceof PokemonShopTransactionRequestConflictPersistenceError) {
        throw new PokemonShopSaleError('REQUEST_CONFLICT', error.message);
      }

      console.error('[PokemonShop] sale persistence failed', {
        trainerId: input.trainerId,
        requestId: input.requestId,
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        error,
      });

      throw new PokemonShopSaleError(
        'PERSISTENCE_FAILED',
        'The sale could not be completed.',
      );
    }

    const updatedTrainerState = this.trainerStateStore.setInventoryAndMoney(
      input.trainerId,
      persisted.inventory,
      persisted.money,
    );

    return {
      trainerState: updatedTrainerState,
      quote: {
        itemId: input.itemId,
        quantity: input.quantity,
        unitPrice: persisted.unitPrice,
        totalPrice: persisted.totalPrice,
      },
      inventoryQuantity: persisted.inventoryQuantity,
      replayed: persisted.replayed,
    };
  }
}
