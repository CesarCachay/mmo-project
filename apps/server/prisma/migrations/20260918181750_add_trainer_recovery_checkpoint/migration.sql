-- AlterTable
ALTER TABLE "pokemon_trainers" ADD COLUMN     "recovery_direction" VARCHAR(8),
ADD COLUMN     "recovery_map_id" VARCHAR(64),
ADD COLUMN     "recovery_x" DOUBLE PRECISION,
ADD COLUMN     "recovery_y" DOUBLE PRECISION;
