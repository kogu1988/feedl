-- pgvector (Neon destekler). Migration'ın tekrar çalıştırılabilir olması için IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "embedding_vector" vector(2048);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "duplicate_of" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "duplicate_note" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_duplicate_of_posts_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;