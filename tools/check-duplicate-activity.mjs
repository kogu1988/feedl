// Silmeden önce kanıt: iki kimlikten hangisi gerçekten KULLANILIYOR?
// users.id'ye atıfta bulunan tüm kolonları bulup her iki id için satır sayar.
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
const rows = await sql`select id, role, created_at, updated_at from users where lower(email)='oguzkir@gmail.com' order by created_at`;
const ids = rows.map((r) => r.id);
console.log("kimlikler:", rows);

// users.id'ye FK olan kolonlar
const fks = await sql`
  select tc.table_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and ccu.table_name = 'users' and ccu.column_name = 'id'
  order by tc.table_name`;

console.log(`\nusers.id'ye bakan ${fks.length} FK kolonu taraniyor...\n`);
const idList = ids.map((i) => `'${i}'`).join(",");
for (const fk of fks) {
  const q = `select '${fk.table_name}' as t, '${fk.column_name}' as c, ${fk.column_name} as uid, count(*)::int n, max(created_at) as last
    from ${fk.table_name} where ${fk.column_name} in (${idList}) group by ${fk.column_name} order by uid`;
  try {
    const res = await sql.query(q);
    if (res.length > 0) {
      console.log(`${fk.table_name}.${fk.column_name}:`, res);
    }
  } catch {
    // created_at olmayan tablolar için tekrar dene
    try {
      const res2 = await sql.query(
        `select '${fk.table_name}' as t, ${fk.column_name} as uid, count(*)::int n from ${fk.table_name} where ${fk.column_name} in (${idList}) group by ${fk.column_name}`,
      );
      if (res2.length > 0) console.log(`${fk.table_name}.${fk.column_name} (created_at yok):`, res2);
    } catch {
      /* atla */
    }
  }
}
