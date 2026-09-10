// Migration 0055 uygulayıcı — drizzle-kit migrate Neon'da takıldığı için
// DDL literal olarak çalıştırılır (bkz. 0052/0053/0054 için aynı yaklaşım).
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

await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_digest" boolean DEFAULT true NOT NULL`;
await sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "digest_last_sent_at" timestamp with time zone`;

const cols = await sql`
  select table_name, column_name, data_type, column_default, is_nullable
  from information_schema.columns
  where (table_name = 'users' and column_name = 'email_digest')
     or (table_name = 'workspaces' and column_name = 'digest_last_sent_at')
  order by table_name`;
console.log("applied:", cols);
