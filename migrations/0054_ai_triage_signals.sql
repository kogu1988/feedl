ALTER TABLE "posts" ADD COLUMN "triage_label" varchar(20);--> statement-breakpoint
CREATE TABLE "ai_triage_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"ai_value" varchar(40),
	"correct_value" varchar(40),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "ai_triage_signals" ADD CONSTRAINT "ai_triage_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_triage_signals" ADD CONSTRAINT "ai_triage_signals_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_triage_signals" ADD CONSTRAINT "ai_triage_signals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_triage_signals_post_kind_key" ON "ai_triage_signals" USING btree ("post_id","kind");--> statement-breakpoint
CREATE INDEX "ai_triage_signals_workspace_created_idx" ON "ai_triage_signals" USING btree ("workspace_id","created_at");
