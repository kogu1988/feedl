CREATE TYPE "public"."widget_triage_type" AS ENUM('feedback', 'support', 'clarify', 'unrecognized');--> statement-breakpoint
CREATE TABLE "widget_triages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text,
	"message" text NOT NULL,
	"classification" "widget_triage_type" NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_triages" ADD CONSTRAINT "widget_triages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;