-- Sprint 38: widget origin yönetimi (PM raporu §8.2) — workspace bazlı
-- admin yönetimli allowlist. Feedl'in kendi origin'i kod tarafında daima
-- izinlidir; bu tablo müşteri siteleri içindir. Şema: lib/db/schema.ts
-- widgetOrigins (snapshot 0021'de eşlenik).

CREATE TABLE "widget_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"origin" varchar(200) NOT NULL,
	"label" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_origins" ADD CONSTRAINT "widget_origins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "widget_origins_workspace_origin_key" ON "widget_origins" USING btree ("workspace_id","origin");
