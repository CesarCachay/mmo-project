-- CreateEnum
CREATE TYPE "AccountProvider" AS ENUM ('GOOGLE');

-- AlterTable
ALTER TABLE "pokemon_trainers" ADD COLUMN     "account_id" UUID;

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "provider" "AccountProvider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_email_idx" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_user_id_key" ON "accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "pokemon_trainers_account_id_idx" ON "pokemon_trainers"("account_id");

-- AddForeignKey
ALTER TABLE "pokemon_trainers" ADD CONSTRAINT "pokemon_trainers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
