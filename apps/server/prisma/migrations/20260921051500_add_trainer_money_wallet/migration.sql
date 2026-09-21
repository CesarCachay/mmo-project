ALTER TABLE "pokemon_trainers"
ADD COLUMN "money" INTEGER NOT NULL DEFAULT 3000;

ALTER TABLE "pokemon_trainers"
ADD CONSTRAINT "pokemon_trainers_money_range_check"
CHECK ("money" >= 0 AND "money" <= 999999);
