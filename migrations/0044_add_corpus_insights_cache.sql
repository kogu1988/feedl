ALTER TABLE "workspaces" ADD COLUMN "corpus_insights" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "corpus_insights_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "corpus_insights_status" varchar(20) DEFAULT 'idle' NOT NULL;