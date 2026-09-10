// Yetim kullanıcı satırı silinirse içerik ne olur? FK ON DELETE davranışları.
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

const fks = await sql`
  select tc.table_name, kcu.column_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and ccu.table_name = 'users' and ccu.column_name = 'id'
  order by rc.delete_rule, tc.table_name`;
console.log("users.id FK ON DELETE davranislari:");
for (const f of fks) console.log(` ${f.delete_rule.padEnd(10)} ${f.table_name}.${f.column_name}`);

const ORPHAN = "user_3Ih7nSRpCcyPj6abvmTQ1ThkjfU";
console.log("\nyetim satirin sahip oldugu icerik:");
for (const [t, c] of [
  ["posts", "user_id"],
  ["comments", "user_id"],
  ["votes", "user_id"],
]) {
  const r = await sql.query(`select count(*)::int n from ${t} where ${c} = '${ORPHAN}'`);
  console.log(` ${t}: ${r[0].n}`);
}
