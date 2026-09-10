ALTER TABLE "posts" ADD COLUMN "device_type" varchar(10);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "viewport_width" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "viewport_height" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "browser" varchar(60);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "os" varchar(60);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "page_url" text;
