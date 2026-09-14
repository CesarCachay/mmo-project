/*
  Warnings:

  - You are about to drop the column `session_token_hash` on the `pokemon_trainers` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "pokemon_trainers_session_token_hash_key";

-- AlterTable
ALTER TABLE "pokemon_trainers" DROP COLUMN "session_token_hash";
