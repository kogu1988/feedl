CREATE TYPE "public"."post_sentiment" AS ENUM('pozitif', 'notr', 'negatif');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('open', 'planned', 'in-progress', 'shipped');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "post_status" DEFAULT 'open' NOT NULL,
	"sentiment_label" "post_sentiment",
	"ai_keywords" text[],
	"ai_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");