-- CreateTable
CREATE TABLE "account_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_sessions_token_hash_key" ON "account_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "account_sessions_account_id_idx" ON "account_sessions"("account_id");

-- CreateIndex
CREATE INDEX "account_sessions_expires_at_idx" ON "account_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "account_sessions" ADD CONSTRAINT "account_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
