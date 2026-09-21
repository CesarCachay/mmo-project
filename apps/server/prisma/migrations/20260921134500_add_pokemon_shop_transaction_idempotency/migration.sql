CREATE TABLE "pokemon_shop_transactions" (
    "trainer_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "operation" VARCHAR(8) NOT NULL,
    "catalog_id" VARCHAR(64) NOT NULL,
    "item_id" VARCHAR(64) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "total_price" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pokemon_shop_transactions_pkey" PRIMARY KEY ("trainer_id", "request_id"),
    CONSTRAINT "pokemon_shop_transactions_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
    CONSTRAINT "pokemon_shop_transactions_prices_check" CHECK ("unit_price" >= 0 AND "total_price" >= 0),
    CONSTRAINT "pokemon_shop_transactions_operation_check" CHECK ("operation" IN ('buy', 'sell'))
);

CREATE INDEX "pokemon_shop_transactions_created_at_idx"
ON "pokemon_shop_transactions"("created_at");

ALTER TABLE "pokemon_shop_transactions"
ADD CONSTRAINT "pokemon_shop_transactions_trainer_id_fkey"
FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
