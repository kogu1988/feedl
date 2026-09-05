-- Sprint 40: changelog abonelikleri (PM raporu §8.4 — "yeni duyurular
-- için abone ol"). Clerk girişi olmayan ziyaretçiler de e-posta ile
-- abone olabilir; (workspace_id, email) unique tekrar aboneliği tek
-- satırda tutar. unsubscribe_token: duyuru maili altındaki token'lı
-- çıkış linki. Şema: lib/db/schema.ts changelogSubscribers (snapshot
-- 0023'te eşlenik).

CREATE TABLE "changelog_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "changelog_subscribers" ADD CONSTRAINT "changelog_subscribers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_subscribers" ADD CONSTRAINT "changelog_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token");--> statement-breakpoint
ALTER TABLE "changelog_subscribers" ADD CONSTRAINT "changelog_subscribers_workspace_email_unique" UNIQUE("workspace_id","email");
