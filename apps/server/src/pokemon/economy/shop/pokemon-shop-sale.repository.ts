import { Injectable } from '@nestjs/common';

import {
  POKEMON_MAX_MONEY,
  createPokemonInventory,
  createPokemonMoney,
  isPokemonItemId,
  type PokemonInventory,
  type PokemonItemId,
  type PokemonMoney,
  type PokemonShopCatalogId,
} from '@cesar-mmo/shared';

import { PrismaService } from '#app/database/prisma.service';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import { reservePokemonShopTransaction } from './pokemon-shop-transaction.persistence';

export class PokemonShopInsufficientInventoryPersistenceError extends Error {
  constructor() {
    super('The trainer does not own enough of that item to sell it.');
    this.name = 'PokemonShopInsufficientInventoryPersistenceError';
  }
}

export class PokemonShopWalletLimitPersistenceError extends Error {
  constructor() {
    super('The trainer wallet cannot hold the proceeds of this sale.');
    this.name = 'PokemonShopWalletLimitPersistenceError';
  }
}

export interface PokemonShopSalePersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly requestId: string;
  readonly catalogId: PokemonShopCatalogId;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
}

export interface PokemonShopSalePersistenceResult {
  readonly replayed: boolean;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
  readonly money: PokemonMoney;
  readonly inventory: PokemonInventory;
  readonly inventoryQuantity: number;
}

@Injectable()
export class PokemonShopSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applySale(
    input: PokemonShopSalePersistenceInput,
  ): Promise<PokemonShopSalePersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await reservePokemonShopTransaction(tx, {
        trainerId: input.trainerId,
        requestId: input.requestId,
        operation: 'sell',
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalPrice: input.totalPrice,
      });

      /*
       * IMPORTANT LOCK ORDER: wallet first, inventory second.
       * BUY and Trainer Battle rewards use the same order. Keeping one order
       * prevents wallet/inventory deadlocks when durable mutations overlap.
       */
      const walletRows = await tx.$queryRaw<Array<{ money: number }>>`
        SELECT "money"
        FROM "pokemon_trainers"
        WHERE "id" = CAST(${input.trainerId} AS uuid)
        LIMIT 1
        FOR UPDATE
      `;

      const walletRow = walletRows[0];

      if (!walletRow) {
        throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
      }

      let money = createPokemonMoney(walletRow.money);

      if (!reservation.replayed) {
        if (money + reservation.totalPrice > POKEMON_MAX_MONEY) {
          throw new PokemonShopWalletLimitPersistenceError();
        }

        const itemRows = await tx.$queryRaw<Array<{ quantity: number }>>`
          UPDATE "pokemon_trainer_inventory_items"
          SET "quantity" = "quantity" - ${input.quantity}
          WHERE "trainer_id" = CAST(${input.trainerId} AS uuid)
            AND "item_id" = ${input.itemId}
            AND "quantity" >= ${input.quantity}
          RETURNING "quantity"
        `;

        const itemRow = itemRows[0];

        if (!itemRow) {
          throw new PokemonShopInsufficientInventoryPersistenceError();
        }

        if (itemRow.quantity === 0) {
          await tx.$executeRaw`
            DELETE FROM "pokemon_trainer_inventory_items"
            WHERE "trainer_id" = CAST(${input.trainerId} AS uuid)
              AND "item_id" = ${input.itemId}
              AND "quantity" = 0
          `;
        }

        const updatedWalletRows = await tx.$queryRaw<Array<{ money: number }>>`
          UPDATE "pokemon_trainers"
          SET "money" = "money" + ${reservation.totalPrice},
              "updated_at" = NOW()
          WHERE "id" = CAST(${input.trainerId} AS uuid)
          RETURNING "money"
        `;

        const updatedWalletRow = updatedWalletRows[0];

        if (!updatedWalletRow) {
          throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
        }

        money = createPokemonMoney(updatedWalletRow.money);
      }

      const inventoryRows = await tx.$queryRaw<
        Array<{ itemId: string; quantity: number }>
      >`
        SELECT
          "item_id" AS "itemId",
          "quantity"
        FROM "pokemon_trainer_inventory_items"
        WHERE "trainer_id" = CAST(${input.trainerId} AS uuid)
        ORDER BY "item_id" ASC
      `;

      const inventory = createPokemonInventory(
        inventoryRows.map((row) => {
          if (!isPokemonItemId(row.itemId)) {
            throw new Error(
              `Unknown Pokémon inventory item "${row.itemId}" persisted for trainer "${input.trainerId}"`,
            );
          }

          return {
            itemId: row.itemId,
            quantity: row.quantity,
          };
        }),
      );

      const inventoryQuantity =
        inventory.items.find((item) => item.itemId === input.itemId)?.quantity ??
        0;

      return {
        replayed: reservation.replayed,
        unitPrice: createPokemonMoney(reservation.unitPrice),
        totalPrice: createPokemonMoney(reservation.totalPrice),
        money,
        inventory,
        inventoryQuantity,
      };
    });
  }
}
