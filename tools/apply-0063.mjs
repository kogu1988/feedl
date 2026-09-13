// Migration 0063 uygulayıcı — örnek veri işareti (is_sample).
// Gerekçe: migrations/0063_sample_data_flag.sql
//
// IDEMPOTENT: IF NOT EXISTS ile ifade ifade çalışır.
//
// Kullanım: `node tools/apply-0063.mjs`
// (`.env.local`'deki DATABASE_URL — ÜRETİM. Migration'lar elle uygulanır,
// `drizzle-kit push` ASLA kullanılmaz.)
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

const statements = [
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "posts_workspace_is_sample_idx" ON "posts" ("workspace_id", "is_sample")`,
  `CREATE INDEX IF NOT EXISTS "companies_workspace_is_sample_idx" ON "companies" ("workspace_id", "is_sample")`,
  `CREATE INDEX IF NOT EXISTS "opportunities_workspace_is_sample_idx" ON "opportunities" ("workspace_id", "is_sample")`,
];

for (const statement of statements) {
  await sql.query(statement);
}

console.log("✅ 0063 applied — doğrulama:");
console.table(
  await sql.query(
    `select table_name, column_name, data_type, column_default
       from information_schema.columns
      where column_name = 'is_sample'
      order by table_name`,
  ),
);
