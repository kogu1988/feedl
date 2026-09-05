CREATE TYPE "public"."ai_suggestion_status" AS ENUM('pending', 'approved', 'rejected', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."ai_suggestion_type" AS ENUM('duplicate');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"type" "ai_suggestion_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"status" "ai_suggestion_status" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_suggestions_status_idx" ON "ai_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_suggestions_post_id_idx" ON "ai_suggestions" USING btree ("post_id");