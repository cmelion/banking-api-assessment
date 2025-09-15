-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "owner_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "counterparty" TEXT,
    "transfer_id" TEXT,
    "balance_after" DECIMAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_account_id" TEXT NOT NULL,
    "to_account_id" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "masked_pan" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "exp_month" INTEGER NOT NULL,
    "exp_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "file_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "statements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_idempotency_key_key" ON "transfers"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");
