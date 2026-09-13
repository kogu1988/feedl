// Migration 0062 uygulayıcı — birinci taraf ürün analitiği (analytics_events).
// Gerekçe: migrations/0062_analytics_events.sql
//
// IDEMPOTENT: ifade ifade çalışır; her ifade kendi varlık kontrolünü taşır
// (CREATE TABLE/INDEX IF NOT EXISTS, DO bloğunda pg_constraint kontrolü).
//
// Kullanım: `node tools/apply-0062.mjs`
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
  `CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "user_id" text,
  "name" varchar(60) NOT NULL,
  "props" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_workspace_id_workspaces_id_fk'
  ) THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_workspace_id_workspaces_id_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_name_created_idx" ON "analytics_events" ("name", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_workspace_created_idx" ON "analytics_events" ("workspace_id", "created_at")`,
];

for (const statement of statements) {
  await sql.query(statement);
}

console.log("✅ 0062 applied — doğrulama:");
console.table(
  await sql.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_name = 'analytics_events'
      order by ordinal_position`,
  ),
);
console.table(
  await sql.query(
    `select indexname from pg_indexes where tablename = 'analytics_events' order by indexname`,
  ),
);
