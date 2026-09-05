ALTER TABLE "comments" ADD COLUMN "merged_from_post_id" uuid;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "merged_from_post_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_merged_from_post_id_posts_id_fk" FOREIGN KEY ("merged_from_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_merged_from_post_id_posts_id_fk" FOREIGN KEY ("merged_from_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;