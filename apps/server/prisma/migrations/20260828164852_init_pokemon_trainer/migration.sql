-- CreateTable
CREATE TABLE "pokemon_trainers" (
    "id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pokemon_trainers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pokemon_trainers_session_token_hash_key" ON "pokemon_trainers"("session_token_hash");
