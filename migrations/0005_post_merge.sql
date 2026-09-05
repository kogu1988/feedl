CREATE TABLE "post_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_post_id" uuid NOT NULL,
	"target_post_id" uuid NOT NULL,
	"moved_vote_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moved_comment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unmerged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "merged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post_merges" ADD CONSTRAINT "post_merges_source_post_id_posts_id_fk" FOREIGN KEY ("source_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_merges" ADD CONSTRAINT "post_merges_target_post_id_posts_id_fk" FOREIGN KEY ("target_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_merges_source_idx" ON "post_merges" USING btree ("source_post_id","merged_at");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_merged_into_id_posts_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;