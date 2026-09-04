CREATE TYPE "public"."board_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" text,
	"visibility" "board_visibility" DEFAULT 'public' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boards_workspace_slug_key" ON "boards" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "boards_workspace_sort_idx" ON "boards" USING btree ("workspace_id","sort_order");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Sprint 48b: varsayılan board seed + mevcut postları ona atama.
-- Her workspace için bir "Genel" board (slug=default) oluşturulur ve
-- board_id NULL kalan mevcut fikirler bu board'a taşınır.
INSERT INTO "boards" (workspace_id, name, slug, description, visibility, sort_order)
SELECT w.id, 'Genel', 'genel', NULL, 'public', 0
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.workspace_id = w.id);--> statement-breakpoint

UPDATE posts p
SET board_id = (SELECT b.id FROM boards b WHERE b.workspace_id = p.workspace_id AND b.slug = 'genel' LIMIT 1)
WHERE p.board_id IS NULL;