-- CreateTable
CREATE TABLE "pokemon_pending_evolutions" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "pokemon_instance_id" UUID NOT NULL,
    "source_species_id" INTEGER NOT NULL,
    "source_form_id" INTEGER NOT NULL,
    "target_species_id" INTEGER NOT NULL,
    "target_form_id" INTEGER NOT NULL,
    "trigger_level" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pokemon_pending_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pokemon_pending_evolutions_pokemon_instance_id_key" ON "pokemon_pending_evolutions"("pokemon_instance_id");

-- CreateIndex
CREATE INDEX "pokemon_pending_evolutions_trainer_id_idx" ON "pokemon_pending_evolutions"("trainer_id");

-- AddForeignKey
ALTER TABLE "pokemon_pending_evolutions" ADD CONSTRAINT "pokemon_pending_evolutions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokemon_pending_evolutions" ADD CONSTRAINT "pokemon_pending_evolutions_pokemon_instance_id_fkey" FOREIGN KEY ("pokemon_instance_id") REFERENCES "pokemon_instances"("instance_id") ON DELETE CASCADE ON UPDATE CASCADE;
