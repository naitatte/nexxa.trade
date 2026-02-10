CREATE TABLE "wallet_account" (
  "user_id" text PRIMARY KEY REFERENCES "user"(id) ON DELETE cascade,
  "currency" text NOT NULL DEFAULT 'USD',
  "available_usd_cents" integer NOT NULL DEFAULT 0,
  "reserved_usd_cents" integer NOT NULL DEFAULT 0,
  "lifetime_earned_usd_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "wallet_account_currency_idx" ON "wallet_account" ("currency");

CREATE TABLE "wallet_ledger" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  "type" text NOT NULL,
  "amount_usd_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "reference_type" text,
  "reference_id" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "wallet_ledger_user_id_idx" ON "wallet_ledger" ("user_id");
CREATE INDEX "wallet_ledger_created_at_idx" ON "wallet_ledger" ("created_at");

CREATE TABLE "withdrawal_request" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  "amount_usd_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "status" text NOT NULL DEFAULT 'pending_admin',
  "destination" text NOT NULL,
  "chain" text,
  "tx_hash" text,
  "admin_id" text,
  "reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "approved_at" timestamp,
  "processed_at" timestamp,
  "paid_at" timestamp,
  "rejected_at" timestamp,
  "canceled_at" timestamp,
  "failed_at" timestamp
);

CREATE INDEX "withdrawal_request_user_id_idx" ON "withdrawal_request" ("user_id");
CREATE INDEX "withdrawal_request_status_idx" ON "withdrawal_request" ("status");
CREATE INDEX "withdrawal_request_created_at_idx" ON "withdrawal_request" ("created_at");

CREATE TABLE "withdrawal_event" (
  "id" text PRIMARY KEY,
  "withdrawal_id" text NOT NULL REFERENCES "withdrawal_request"(id) ON DELETE cascade,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_id" text,
  "reason" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "withdrawal_event_withdrawal_id_idx" ON "withdrawal_event" ("withdrawal_id");
CREATE INDEX "withdrawal_event_created_at_idx" ON "withdrawal_event" ("created_at");
