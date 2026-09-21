import type {
  PokemonItemId,
  PokemonMoney,
  PokemonShopCatalogId,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

export type PokemonShopTransactionOperation = 'buy' | 'sell';

export interface PokemonShopTransactionReservationInput {
  readonly trainerId: PokemonTrainerId;
  readonly requestId: string;
  readonly operation: PokemonShopTransactionOperation;
  readonly catalogId: PokemonShopCatalogId;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
}

export interface PokemonShopTransactionReservation {
  readonly replayed: boolean;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
}

interface PokemonShopTransactionClient {
  $queryRaw<T>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

interface PokemonShopTransactionRow {
  readonly operation: string;
  readonly catalogId: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
}

export class PokemonShopTransactionRequestConflictPersistenceError extends Error {
  constructor() {
    super('That shop request id was already used for another transaction.');
    this.name = 'PokemonShopTransactionRequestConflictPersistenceError';
  }
}

/**
 * Reserves a Trainer-scoped request id in the same PostgreSQL transaction as
 * the economy mutation. The unique primary key makes duplicate delivery
 * exactly-once even across reconnects or server restarts.
 *
 * INSERT ... ON CONFLICT waits for an in-flight duplicate transaction to
 * commit/rollback before resolving, so callers never observe a half-finished
 * receipt row.
 */
export async function reservePokemonShopTransaction(
  tx: PokemonShopTransactionClient,
  input: PokemonShopTransactionReservationInput,
): Promise<PokemonShopTransactionReservation> {
  const insertedRows = await tx.$queryRaw<PokemonShopTransactionRow[]>`
    INSERT INTO "pokemon_shop_transactions" (
      "trainer_id",
      "request_id",
      "operation",
      "catalog_id",
      "item_id",
      "quantity",
      "unit_price",
      "total_price"
    )
    VALUES (
      CAST(${input.trainerId} AS uuid),
      CAST(${input.requestId} AS uuid),
      ${input.operation},
      ${input.catalogId},
      ${input.itemId},
      ${input.quantity},
      ${input.unitPrice},
      ${input.totalPrice}
    )
    ON CONFLICT ("trainer_id", "request_id") DO NOTHING
    RETURNING
      "operation",
      "catalog_id" AS "catalogId",
      "item_id" AS "itemId",
      "quantity",
      "unit_price" AS "unitPrice",
      "total_price" AS "totalPrice"
  `;

  const inserted = insertedRows[0];

  if (inserted) {
    return {
      replayed: false,
      unitPrice: inserted.unitPrice,
      totalPrice: inserted.totalPrice,
    };
  }

  const existingRows = await tx.$queryRaw<PokemonShopTransactionRow[]>`
    SELECT
      "operation",
      "catalog_id" AS "catalogId",
      "item_id" AS "itemId",
      "quantity",
      "unit_price" AS "unitPrice",
      "total_price" AS "totalPrice"
    FROM "pokemon_shop_transactions"
    WHERE "trainer_id" = CAST(${input.trainerId} AS uuid)
      AND "request_id" = CAST(${input.requestId} AS uuid)
    LIMIT 1
  `;

  const existing = existingRows[0];

  if (!existing) {
    throw new Error(
      `Pokémon Shop transaction reservation disappeared for Trainer "${input.trainerId}" request "${input.requestId}"`,
    );
  }

  if (
    existing.operation !== input.operation ||
    existing.catalogId !== input.catalogId ||
    existing.itemId !== input.itemId ||
    existing.quantity !== input.quantity
  ) {
    throw new PokemonShopTransactionRequestConflictPersistenceError();
  }

  return {
    replayed: true,
    unitPrice: existing.unitPrice,
    totalPrice: existing.totalPrice,
  };
}
