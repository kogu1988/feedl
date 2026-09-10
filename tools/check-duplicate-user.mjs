// İki aynı-e-postalı kullanıcı satırının hangisi AKTİF kullanılıyor?
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
const IDS = [
  "user_3Ih7nSRpCcyPj6abvmTQ1ThkjfU", // admin, 2026-08-31
  "user_3IycZ06AWMcWs6IUXY5eAnVzoa", // customer, 2026-09-07
];
// NOT: ikinci id'yi tam eşleştirmek için yeniden oku.
const rows = await sql`select id, role, created_at, updated_at from users where lower(email)='oguzkir@gmail.com' order by created_at`;
console.log("users:", rows);
const ids = rows.map((r) => r.id);

console.log("workspace_members:", await sql`
  select user_id, workspace_id, role, created_at from workspace_members where user_id = any(${ids}::text[])`);

console.log("posts by these users:", await sql`
  select user_id, count(*)::int n, max(created_at) last from posts where user_id = any(${ids}::text[]) group by user_id`);

console.log("comments:", await sql`
  select user_id, count(*)::int n, max(created_at) last from comments where user_id = any(${ids}::text[]) group by user_id`);

console.log("votes:", await sql`
  select user_id, count(*)::int n, max(created_at) last from votes where user_id = any(${ids}::text[]) group by user_id`);

console.log("api_keys:", await sql`
  select user_id, count(*)::int n from api_keys where user_id = any(${ids}::text[]) group by user_id`);

console.log("tum users (aktivite icin):", await sql`
  select id, email, role, created_at from users order by created_at`);
void IDS;
