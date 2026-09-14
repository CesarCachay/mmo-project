-- AlterTable
ALTER TABLE "pokemon_trainers" ADD COLUMN     "avatar_id" VARCHAR(64),
ADD COLUMN     "display_name" VARCHAR(16),
ALTER COLUMN "session_token_hash" DROP NOT NULL;
