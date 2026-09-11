// Göç sonrası doğrulama: yetim referans kaldı mı, içerik doğru mu, yazar
// adları çözülüyor mu?
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
const ORPHAN = "user_3Ih7nSRpCcyPj6abvmTQ1ThkjfU";
const LIVE = "user_3IycZ06AWPMcWs6IUXY5eAnVzoa";

console.log("1) yetim satır duruyor mu:", await sql`select id from users where id = ${ORPHAN}`);
console.log("2) aynı e-postalı satır sayısı:", await sql`
  select count(*)::int n from users where lower(email) = 'oguzkir@gmail.com'`);
console.log("3) canlı kimlik:", await sql`
  select id, email, name, role from users where id = ${LIVE}`);

// FK'lı 13 kolon + FK'sız 1 kolonda yetim referansı kaldı mı?
const cols = await sql`
  select tc.table_name as t, kcu.column_name as c
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and ccu.table_name = 'users' and ccu.column_name = 'id'`;
let dangling = 0;
for (const { t, c } of [...cols, { t: "widget_triages", c: "user_id" }]) {
  const n = (await sql.query(`select count(*)::int n from ${t} where ${c} = '${ORPHAN}'`))[0].n;
  if (n > 0) {
    dangling += n;
    console.log(`   ⚠️ ${t}.${c}: ${n}`);
  }
}
console.log("4) kalan yetim referans:", dangling === 0 ? "✅ 0" : `❌ ${dangling}`);

console.log("5) canlı kimliğin içeriği:", await sql`
  select
    (select count(*)::int from posts where user_id = ${LIVE}) as posts,
    (select count(*)::int from comments where user_id = ${LIVE}) as comments,
    (select count(*)::int from votes where user_id = ${LIVE}) as votes`);

console.log("6) yazar adları çözülüyor mu (örnek 3 fikir):", await sql`
  select p.title, u.name, u.email
  from posts p left join users u on u.id = p.user_id
  where p.user_id = ${LIVE} order by p.created_at limit 3`);
