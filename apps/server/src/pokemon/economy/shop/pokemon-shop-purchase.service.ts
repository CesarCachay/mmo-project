import { Injectable } from '@nestjs/common';

import {
  quotePokemonShopPurchase,
  type PokemonItemId,
  type PokemonShopCatalogId,
  type PokemonShopPriceQuote,
  type PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';

import { PokemonShopPurchaseOperationQueue } from './pokemon-shop-purchase-operation.queue';
import {
  PokemonShopInsufficientFundsPersistenceError,
  PokemonShopPurchaseRepository,
} from './pokemon-shop-purchase.repository';
import { PokemonShopTransactionRequestConflictPersistenceError } from './pokemon-shop-transaction.persistence';

export type PokemonShopPurchaseErrorCode =
  | 'TRAINER_STATE_NOT_FOUND'
  | 'ITEM_NOT_AVAILABLE'
  | 'INSUFFICIENT_FUNDS'
  | 'REQUEST_CONFLICT'
  | 'PERSISTENCE_FAILED';

export class PokemonShopPurchaseError extends Error {
  constructor(
    public readonly code: PokemonShopPurchaseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonShopPurchaseError';
  }
}

export interface PokemonShopPurchaseInput {
  readonly trainerId: PokemonTrainerId;
  readonly requestId: string;
  readonly catalogId: PokemonShopCatalogId;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
}

export interface PokemonShopPurchaseResult {
  readonly trainerState: PokemonTrainerState;
  readonly quote: PokemonShopPriceQuote;
  readonly inventoryQuantity: number;
  readonly replayed: boolean;
}

@Injectable()
export class PokemonShopPurchaseService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly repository: PokemonShopPurchaseRepository,
    private readonly operationQueue: PokemonShopPurchaseOperationQueue,
  ) {}

  public purchase(
    input: PokemonShopPurchaseInput,
  ): Promise<PokemonShopPurchaseResult> {
    return this.operationQueue.enqueue(input.trainerId, () =>
      this.executePurchase(input),
    );
  }

  private async executePurchase(
    input: PokemonShopPurchaseInput,
  ): Promise<PokemonShopPurchaseResult> {
    const trainerState = this.trainerStateStore.get(input.trainerId);

    if (!trainerState) {
      throw new PokemonShopPurchaseError(
        'TRAINER_STATE_NOT_FOUND',
        `Pokémon Trainer state not found for trainer "${input.trainerId}"`,
      );
    }

    const quote = quotePokemonShopPurchase(
      input.catalogId,
      input.itemId,
      input.quantity,
    );

    if (!quote) {
      throw new PokemonShopPurchaseError(
        'ITEM_NOT_AVAILABLE',
        'That item is not available from this Poké Shop.',
      );
    }

    let persisted;

    try {
      persisted = await this.repository.applyPurchase({
        trainerId: input.trainerId,
        requestId: input.requestId,
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonShopInsufficientFundsPersistenceError) {
        throw new PokemonShopPurchaseError(
          'INSUFFICIENT_FUNDS',
          'You do not have enough money for this purchase.',
        );
      }

      if (error instanceof PokemonShopTransactionRequestConflictPersistenceError) {
        throw new PokemonShopPurchaseError(
          'REQUEST_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonShop] purchase persistence failed', {
        trainerId: input.trainerId,
        requestId: input.requestId,
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        error,
      });

      throw new PokemonShopPurchaseError(
        'PERSISTENCE_FAILED',
        'The purchase could not be completed.',
      );
    }

    /*
     * DB FIRST -> RAM SECOND. This also reconciles RAM on an idempotent replay
     * using the current persisted wallet/inventory snapshot.
     */
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
