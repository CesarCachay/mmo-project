import { Injectable } from '@nestjs/common';

import {
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

export class PokemonShopInsufficientFundsPersistenceError extends Error {
  constructor() {
    super('The trainer does not have enough money for this purchase.');
    this.name = 'PokemonShopInsufficientFundsPersistenceError';
  }
}

export interface PokemonShopPurchasePersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly requestId: string;
  readonly catalogId: PokemonShopCatalogId;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
}

export interface PokemonShopPurchasePersistenceResult {
  readonly replayed: boolean;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
  readonly money: PokemonMoney;
  readonly inventory: PokemonInventory;
  readonly inventoryQuantity: number;
}

@Injectable()
export class PokemonShopPurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applyPurchase(
    input: PokemonShopPurchasePersistenceInput,
  ): Promise<PokemonShopPurchasePersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await reservePokemonShopTransaction(tx, {
        trainerId: input.trainerId,
        requestId: input.requestId,
        operation: 'buy',
        catalogId: input.catalogId,
        itemId: input.itemId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalPrice: input.totalPrice,
      });

      let money: PokemonMoney;

      if (reservation.replayed) {
        /*
         * Replays are read-only, but lock wallet first so every economy path
         * follows the same wallet -> inventory lock order.
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

        money = createPokemonMoney(walletRow.money);
      } else {
        /*
         * Atomic debit. PostgreSQL owns the authoritative funds check and
         * locks the wallet before the inventory stack is touched.
         */
        const walletRows = await tx.$queryRaw<Array<{ money: number }>>`
          UPDATE "pokemon_trainers"
          SET "money" = "money" - ${reservation.totalPrice},
              "updated_at" = NOW()
          WHERE "id" = CAST(${input.trainerId} AS uuid)
            AND "money" >= ${reservation.totalPrice}
          RETURNING "money"
        `;

        const walletRow = walletRows[0];

        if (!walletRow) {
          const trainerRows = await tx.$queryRaw<Array<{ money: number }>>`
            SELECT "money"
            FROM "pokemon_trainers"
            WHERE "id" = CAST(${input.trainerId} AS uuid)
            LIMIT 1
          `;

          if (!trainerRows[0]) {
            throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
          }

          throw new PokemonShopInsufficientFundsPersistenceError();
        }

        money = createPokemonMoney(walletRow.money);

        const itemRows = await tx.$queryRaw<Array<{ quantity: number }>>`
          INSERT INTO "pokemon_trainer_inventory_items" (
            "trainer_id",
            "item_id",
            "quantity"
          )
          VALUES (
            CAST(${input.trainerId} AS uuid),
            ${input.itemId},
            ${input.quantity}
          )
          ON CONFLICT ("trainer_id", "item_id")
          DO UPDATE SET
            "quantity" = "pokemon_trainer_inventory_items"."quantity" + EXCLUDED."quantity"
          RETURNING "quantity"
        `;

        if (!itemRows[0]) {
          throw new Error('Purchased inventory stack was not returned.');
        }
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
