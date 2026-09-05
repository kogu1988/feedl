ALTER TABLE "changelog_entries" ALTER COLUMN "published_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "changelog_entries" ALTER COLUMN "published_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD COLUMN "status" varchar(20) DEFAULT 'published' NOT NULL;