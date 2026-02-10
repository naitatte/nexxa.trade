CREATE TABLE "wallet_destination" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  "label" text NOT NULL,
  "address" text NOT NULL,
  "chain" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "wallet_destination_user_id_idx" ON "wallet_destination" ("user_id");
CREATE INDEX "wallet_destination_default_idx" ON "wallet_destination" ("user_id", "is_default");
