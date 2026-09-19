CREATE TABLE "pokemon_trainer_battle_progress" (
    "trainer_id" UUID NOT NULL,
    "trainer_battle_id" VARCHAR(64) NOT NULL,
    "defeated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pokemon_trainer_battle_progress_pkey" PRIMARY KEY ("trainer_id","trainer_battle_id")
);

CREATE INDEX "pokemon_trainer_battle_progress_trainer_battle_id_idx"
ON "pokemon_trainer_battle_progress"("trainer_battle_id");

ALTER TABLE "pokemon_trainer_battle_progress"
ADD CONSTRAINT "pokemon_trainer_battle_progress_trainer_id_fkey"
FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
