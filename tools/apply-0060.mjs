// Migration 0060 uygulayıcı — outcome kaydı (post_outcomes).
// Gerekçe: migrations/0060_post_outcomes.sql
//
// IDEMPOTENT: ifade ifade çalışır; her ifade kendi varlık kontrolünü taşır
// (CREATE TABLE/INDEX IF NOT EXISTS, DO bloğunda pg_constraint kontrolü).
//
// Kullanım: `node tools/apply-0060.mjs`
// (`.env.local`'deki DATABASE_URL — ÜRETİM. Bilinçli: migration'lar elle
// uygulanır, `drizzle-kit push` ASLA kullanılmaz.)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const sql = neon(env.DATABASE_URL);

// DO bloğu içinde noktalı virgül olduğu için naif `split(";")` YAPILMAZ.
const statements = [
  `CREATE TABLE IF NOT EXISTS "post_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "outcome_type" varchar(30) NOT NULL,
  "revenue_delta" numeric(12, 2),
  "summary" text NOT NULL,
  "evidence_url" text,
  "occurred_at" date,
  "recorded_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_workspace_id_workspaces_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_workspace_id_workspaces_id_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_post_id_posts_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_post_id_posts_id_fk"
      FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_recorded_by_users_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_recorded_by_users_id_fk"
      FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$`,
  `CREATE INDEX IF NOT EXISTS "post_outcomes_post_idx" ON "post_outcomes" ("post_id")`,
  `CREATE INDEX IF NOT EXISTS "post_outcomes_workspace_idx" ON "post_outcomes" ("workspace_id")`,
];

for (const statement of statements) {
  await sql.query(statement);
}

console.log("✅ 0060 applied — doğrulama:");
console.table(
  await sql.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_name = 'post_outcomes'
      order by ordinal_position`,
  ),
);
console.table(
  await sql.query(
    `select conname from pg_constraint c
       join pg_class t on t.oid = c.conrelid
      where t.relname = 'post_outcomes' and c.contype = 'f'
      order by conname`,
  ),
);
