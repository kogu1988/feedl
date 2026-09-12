// Migration 0056 uygulayıcı — drizzle-kit migrate Neon'da takıldığı için DDL
// literal olarak çalıştırılır (bkz. 0052/0053/0054/0055 için aynı yaklaşım).
//
// Custom domain sahiplik doğrulaması: verified_at + TXT token kolonları ve
// hostname teklik indeksi. Idempotent (IF NOT EXISTS) — tekrar çalıştırılabilir.
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

// Unique indeks kurulamadan önce çakışan değer var mı? Varsa net hata ver
// (aksi halde CREATE INDEX "duplicate key value" ile yarı yolda kalır).
const dupes = await sql.query(
  `select custom_domain, count(*)::int n from workspaces
    where custom_domain is not null group by custom_domain having count(*) > 1`,
);
if (dupes.length > 0) {
  console.error("❌ Aynı custom_domain'i kullanan workspace'ler var, önce düzelt:", dupes);
  process.exit(1);
}

await sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "custom_domain_verification_token" varchar(64)`;
await sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "custom_domain_verified_at" timestamp with time zone`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_custom_domain_key" ON "workspaces" USING btree ("custom_domain")`;

const cols = await sql`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_name = 'workspaces' and column_name like 'custom_domain%'
  order by column_name`;
const idx = await sql`
  select indexname from pg_indexes
  where tablename = 'workspaces' and indexname = 'workspaces_custom_domain_key'`;
console.log("✅ 0056 applied");
console.log("kolonlar:", cols);
console.log("indeks:", idx);
