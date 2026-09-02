-- CreateTable
CREATE TABLE "pokemon_trainer_inventory_items" (
    "trainer_id" UUID NOT NULL,
    "item_id" VARCHAR(64) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "pokemon_trainer_inventory_items_pkey" PRIMARY KEY ("trainer_id","item_id")
);

-- AddForeignKey
ALTER TABLE "pokemon_trainer_inventory_items" ADD CONSTRAINT "pokemon_trainer_inventory_items_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
