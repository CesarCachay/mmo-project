ALTER TABLE "pokemon_instances"
ADD COLUMN "major_status" VARCHAR(32),
ADD COLUMN "status_turns_remaining" INTEGER;

ALTER TABLE "pokemon_instances"
ADD CONSTRAINT "pokemon_instances_major_status_check"
CHECK (
  "major_status" IS NULL OR
  "major_status" IN (
    'burn',
    'poison',
    'badly-poisoned',
    'paralysis',
    'sleep',
    'freeze'
  )
);

ALTER TABLE "pokemon_instances"
ADD CONSTRAINT "pokemon_instances_status_turns_check"
CHECK (
  ("major_status" = 'sleep' AND "status_turns_remaining" IS NOT NULL AND "status_turns_remaining" > 0)
  OR
  ("major_status" IS DISTINCT FROM 'sleep' AND "status_turns_remaining" IS NULL)
);
