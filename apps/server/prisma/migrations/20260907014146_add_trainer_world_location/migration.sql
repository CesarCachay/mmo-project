-- AlterTable
ALTER TABLE "pokemon_trainers" ADD COLUMN     "world_direction" VARCHAR(8),
ADD COLUMN     "world_map_id" VARCHAR(64),
ADD COLUMN     "world_x" DOUBLE PRECISION,
ADD COLUMN     "world_y" DOUBLE PRECISION;
