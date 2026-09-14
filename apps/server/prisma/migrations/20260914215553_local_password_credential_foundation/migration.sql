/*
  Warnings:

  - Made the column `account_id` on table `pokemon_trainers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `avatar_id` on table `pokemon_trainers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `display_name` on table `pokemon_trainers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "AccountProvider" ADD VALUE 'LOCAL';

-- DropForeignKey
ALTER TABLE "pokemon_trainers" DROP CONSTRAINT "pokemon_trainers_account_id_fkey";

-- AlterTable
ALTER TABLE "pokemon_trainers" ALTER COLUMN "account_id" SET NOT NULL,
ALTER COLUMN "avatar_id" SET NOT NULL,
ALTER COLUMN "display_name" SET NOT NULL;

-- CreateTable
CREATE TABLE "account_password_credentials" (
    "account_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_password_credentials_pkey" PRIMARY KEY ("account_id")
);

-- AddForeignKey
ALTER TABLE "account_password_credentials" ADD CONSTRAINT "account_password_credentials_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokemon_trainers" ADD CONSTRAINT "pokemon_trainers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
