// Migration 0058 uygulayıcı — eksik index: companies(workspace_id).
// Gerekçe: migrations/0058_companies_workspace_index.sql
// IDEMPOTENT (IF NOT EXISTS).
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

await sql`CREATE INDEX IF NOT EXISTS "companies_workspace_idx" ON "companies" ("workspace_id")`;

console.log("✅ 0058 applied — doğrulama:");
console.table(
  await sql.query(
    `select indexname from pg_indexes
      where tablename = 'companies' order by indexname`,
  ),
);
