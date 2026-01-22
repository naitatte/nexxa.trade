ALTER TABLE "user" ADD COLUMN "username" text;
ALTER TABLE "user" ADD COLUMN "display_username" text;
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");
