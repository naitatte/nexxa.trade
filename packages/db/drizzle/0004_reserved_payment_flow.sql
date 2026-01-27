CREATE SEQUENCE "payment_derivation_index_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "membership_payment" ADD COLUMN "deposit_address" text;
ALTER TABLE "membership_payment" ADD COLUMN "derivation_index" integer;
ALTER TABLE "membership_payment" ADD COLUMN "sweep_status" text DEFAULT 'pending';
ALTER TABLE "membership_payment" ADD COLUMN "sweep_tx_hash" text;
ALTER TABLE "membership_payment" ADD COLUMN "funding_tx_hash" text;
ALTER TABLE "membership_payment" ADD COLUMN "sweep_attempted_at" timestamp;
ALTER TABLE "membership_payment" ADD COLUMN "funded_at" timestamp;
ALTER TABLE "membership_payment" ADD COLUMN "swept_at" timestamp;
ALTER TABLE "membership_payment" ADD COLUMN "applied_at" timestamp;
ALTER TABLE "membership_payment" ALTER COLUMN "derivation_index" SET DEFAULT nextval('payment_derivation_index_seq');
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_deposit_address_unique" UNIQUE("deposit_address");
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_derivation_index_unique" UNIQUE("derivation_index");
CREATE INDEX "membership_payment_depositAddress_idx" ON "membership_payment" USING btree ("deposit_address");

CREATE TABLE "payment_chain_cursor" (
  "chain" text PRIMARY KEY NOT NULL,
  "contract" text NOT NULL,
  "last_scanned_block" integer NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
