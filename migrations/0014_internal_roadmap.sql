ALTER TABLE "posts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "impact" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "effort" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;