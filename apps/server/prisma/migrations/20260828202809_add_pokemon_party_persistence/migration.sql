-- CreateTable
CREATE TABLE "pokemon_instances" (
    "instance_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "species_id" INTEGER NOT NULL,
    "form_id" INTEGER NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL,
    "experience" INTEGER NOT NULL,
    "current_hp" INTEGER NOT NULL,
    "ability_id" INTEGER NOT NULL,
    "party_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pokemon_instances_pkey" PRIMARY KEY ("instance_id")
);

-- CreateTable
CREATE TABLE "pokemon_instance_moves" (
    "pokemon_instance_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "move_id" INTEGER NOT NULL,
    "current_pp" INTEGER NOT NULL,

    CONSTRAINT "pokemon_instance_moves_pkey" PRIMARY KEY ("pokemon_instance_id","slot")
);

-- CreateIndex
CREATE INDEX "pokemon_instances_trainer_id_idx" ON "pokemon_instances"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "pokemon_instances_trainer_id_party_position_key" ON "pokemon_instances"("trainer_id", "party_position");

-- AddForeignKey
ALTER TABLE "pokemon_instances" ADD CONSTRAINT "pokemon_instances_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokemon_instance_moves" ADD CONSTRAINT "pokemon_instance_moves_pokemon_instance_id_fkey" FOREIGN KEY ("pokemon_instance_id") REFERENCES "pokemon_instances"("instance_id") ON DELETE CASCADE ON UPDATE CASCADE;
