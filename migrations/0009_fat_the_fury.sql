ALTER TYPE "public"."post_status" ADD VALUE 'under-review' BEFORE 'planned';--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE 'closed';--> statement-breakpoint
CREATE TABLE "post_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"old_status" "post_status",
	"new_status" "post_status" NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_status_history" ADD CONSTRAINT "post_status_history_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_status_history" ADD CONSTRAINT "post_status_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_status_history_post_idx" ON "post_status_history" USING btree ("post_id","created_at");