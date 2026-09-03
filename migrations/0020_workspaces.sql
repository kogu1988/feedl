-- Sprint 37: Workspace hazırlık migration'ı (PM raporu §8 madde 1).
-- workspaces tablosu + üst düzey kaynak tablolarına workspace_id + backfill.
-- Not: 0019 snapshot'ı olmadığından generate, opportunities/post_opportunities
-- CREATE'lerini de üretmişti; bu dosya elle düzenlendi (sadece gerçek diff).

CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- Tek workspace dönemi: varsayılan (seed) workspace. lib/db/workspace.ts
-- bu satırı merkezi olarak okur; slug ileride subdomain kaynağıdır.
INSERT INTO "workspaces" ("name", "slug") VALUES ('feedl', 'feedl');
--> statement-breakpoint

-- tags: global unique(name) → workspace başına unique(workspace_id, name)
ALTER TABLE "tags" DROP CONSTRAINT "tags_name_unique";--> statement-breakpoint

-- ADD COLUMN (nullable) → backfill → SET NOT NULL sırası: mevcut satırlar
-- workspace_id'siz kalmaz, kısıt ancak backfill sonrası devreye girer.
ALTER TABLE "api_keys" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "api_keys" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "changelog_entries" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "changelog_entries" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "companies" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "opportunities" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "posts" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_views" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "saved_views" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "saved_views" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "tags" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "webhook_endpoints" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'feedl') WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "opportunities_workspace_idx" ON "opportunities" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "posts_workspace_created_idx" ON "posts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "tags_workspace_idx" ON "tags" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_name_unique" UNIQUE("workspace_id","name");
