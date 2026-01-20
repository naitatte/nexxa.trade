CREATE TABLE "commission" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"level" integer NOT NULL,
	"amount_usd_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"inactive_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_usd_cents" integer NOT NULL,
	"chain" text,
	"tx_hash" text,
	"from_address" text,
	"to_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sponsor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'guest' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "membership_status" text DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "membership_tier" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "membership_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_payment_id_membership_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."membership_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payment" ADD CONSTRAINT "membership_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_sponsor_id_user_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_toUserId_idx" ON "commission" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "commission_paymentId_idx" ON "commission" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "membership_status_idx" ON "membership" USING btree ("status");--> statement-breakpoint
CREATE INDEX "membership_expires_at_idx" ON "membership" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "membership_event_userId_idx" ON "membership_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_payment_userId_idx" ON "membership_payment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_payment_status_idx" ON "membership_payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referral_sponsorId_idx" ON "referral" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");