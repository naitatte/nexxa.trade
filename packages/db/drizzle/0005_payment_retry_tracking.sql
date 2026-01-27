ALTER TABLE "membership_payment" ADD COLUMN "sweep_retry_count" integer DEFAULT 0;
ALTER TABLE "membership_payment" ADD COLUMN "sweep_retry_after" timestamp;
ALTER TABLE "membership_payment" ADD COLUMN "sweep_last_error" text;
ALTER TABLE "membership_payment" ADD COLUMN "received_units" text;
ALTER TABLE "membership_payment" ADD COLUMN "expected_units" text;
ALTER TABLE "membership_payment" ADD COLUMN "overpayment_units" text;
CREATE INDEX "membership_payment_sweepStatus_idx" ON "membership_payment" USING btree ("sweep_status");
