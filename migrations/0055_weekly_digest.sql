ALTER TABLE "users" ADD COLUMN "email_digest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "digest_last_sent_at" timestamp with time zone;
