CREATE TABLE "pokemon_trainer_gym_badges" (
    "trainer_id" UUID NOT NULL,
    "badge_id" VARCHAR(64) NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pokemon_trainer_gym_badges_pkey" PRIMARY KEY ("trainer_id","badge_id")
);

CREATE INDEX "pokemon_trainer_gym_badges_badge_id_idx"
ON "pokemon_trainer_gym_badges"("badge_id");

ALTER TABLE "pokemon_trainer_gym_badges"
ADD CONSTRAINT "pokemon_trainer_gym_badges_trainer_id_fkey"
FOREIGN KEY ("trainer_id") REFERENCES "pokemon_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill preserves progression for Trainers who defeated Brock before this
-- dedicated Gym badge table was introduced.
INSERT INTO "pokemon_trainer_gym_badges" (
    "trainer_id",
    "badge_id",
    "awarded_at"
)
SELECT
    "trainer_id",
    'boulder-badge',
    "defeated_at"
FROM "pokemon_trainer_battle_progress"
WHERE "trainer_battle_id" = 'gym-leader-brock'
ON CONFLICT ("trainer_id", "badge_id") DO NOTHING;
