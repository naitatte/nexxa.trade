CREATE TABLE "signal_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"source" text,
	"source_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_message" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"source" text,
	"source_id" text,
	"source_timestamp" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_message_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text,
	"file_name" text,
	"size" integer,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_message_link" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"site_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signal_message" ADD CONSTRAINT "signal_message_channel_id_signal_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."signal_channel"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_message_attachment" ADD CONSTRAINT "signal_message_attachment_message_id_signal_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."signal_message"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_message_link" ADD CONSTRAINT "signal_message_link_message_id_signal_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."signal_message"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "signal_channel_source_idx" ON "signal_channel" USING btree ("source");
--> statement-breakpoint
CREATE INDEX "signal_channel_sort_idx" ON "signal_channel" USING btree ("sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "signal_channel_source_sourceId_idx" ON "signal_channel" USING btree ("source","source_id");
--> statement-breakpoint
CREATE INDEX "signal_message_channelId_idx" ON "signal_message" USING btree ("channel_id");
--> statement-breakpoint
CREATE INDEX "signal_message_createdAt_idx" ON "signal_message" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "signal_message_source_sourceId_idx" ON "signal_message" USING btree ("source","source_id");
--> statement-breakpoint
CREATE INDEX "signal_message_attachment_messageId_idx" ON "signal_message_attachment" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX "signal_message_link_messageId_idx" ON "signal_message_link" USING btree ("message_id");
