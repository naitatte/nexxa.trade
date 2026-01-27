CREATE TABLE "membership_plan" (
	"tier" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_usd_cents" integer NOT NULL,
	"duration_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "membership_plan_active_idx" ON "membership_plan" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "membership_plan_sort_idx" ON "membership_plan" USING btree ("sort_order");
--> statement-breakpoint
INSERT INTO "membership_plan" ("tier", "name", "description", "price_usd_cents", "duration_days", "is_active", "sort_order")
VALUES
	('trial_weekly', 'Trial weekly', 'Perfect for testing the waters. Full access to all features.', 900, 7, true, 10),
	('lifetime', 'Lifetime', 'One-time payment. Long-term access with all future updates included.', 49900, 36500, true, 20),
	('annual', 'Pro annual', 'Best value for committed traders. Includes priority support.', 29900, 365, false, 15)
ON CONFLICT ("tier") DO NOTHING;
