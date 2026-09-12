// Migration 0059 uygulayıcı — dunning grace için durum değişim zamanı.
// Gerekçe: migrations/0059_paddle_dunning_grace.sql
// IDEMPOTENT (ADD COLUMN IF NOT EXISTS).
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

await sql`ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "paddle_status_changed_at" timestamp with time zone`;

console.log("✅ 0059 applied — doğrulama:");
console.table(
  await sql.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_name = 'workspaces' and column_name like 'paddle%'
      order by column_name`,
  ),
);
