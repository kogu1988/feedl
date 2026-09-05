ALTER TABLE "posts" ADD COLUMN "source_ref" varchar(120);--> statement-breakpoint
CREATE UNIQUE INDEX "posts_workspace_source_ref_key" ON "posts" USING btree ("workspace_id","source_ref");