-- CreateTable
CREATE TABLE "pokemon_pending_move_learning" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "pokemon_instance_id" UUID NOT NULL,
    "candidate_move_id" INTEGER NOT NULL,
    "candidate_learned_at_level" INTEGER NOT NULL,
    "remaining_candidates" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pokemon_pending_move_learning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pokemon_pending_move_learning_pokemon_instance_id_key" ON "pokemon_pending_move_learning"("pokemon_instance_id");

-- CreateIndex
CREATE INDEX "pokemon_pending_move_learning_trainer_id_idx" ON "pokemon_pending_move_learning"("trainer_id");

-- AddForeignKey
ALTER TABLE "pokemon_pending_move_learning" ADD CONSTRAINT "pokemon_pending_move_learning_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokemon_pending_move_learning" ADD CONSTRAINT "pokemon_pending_move_learning_pokemon_instance_id_fkey" FOREIGN KEY ("pokemon_instance_id") REFERENCES "pokemon_instances"("instance_id") ON DELETE CASCADE ON UPDATE CASCADE;
