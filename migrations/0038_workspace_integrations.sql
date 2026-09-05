CREATE TABLE "workspace_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"webhook_id" text,
	"webhook_secret" text,
	"url_token" text,
	"resource_types" text[],
	"linear_team_id" text,
	"status" varchar(20) DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_integrations_workspace_provider_key" ON "workspace_integrations" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "workspace_integrations_provider_idx" ON "workspace_integrations" USING btree ("provider");