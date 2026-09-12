// Migration 0061 uygulayıcı — varsayılan workspace'in görünen adı.
// Gerekçe: migrations/0061_default_workspace_name.sql
//
// IDEMPOTENT: yalnız slug='feedl' ve adı 'feedl' DEĞİLSE günceller.
//
// Kullanım: `node tools/apply-0061.mjs`
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

const before = await sql.query(
  `select slug, name from workspaces order by slug`,
);
console.log("önce:");
console.table(before);

await sql.query(`UPDATE "workspaces"
   SET "name" = 'feedl'
 WHERE "slug" = 'feedl'
   AND "name" <> 'feedl'`);

const after = await sql.query(`select slug, name from workspaces order by slug`);
console.log("sonra:");
console.table(after);
