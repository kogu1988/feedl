// Aynı doğrulanmış e-postayla açılmış İKİNCİ Clerk kimliğini sahibiyle
// hizalar: rolü 'admin' yapar ve workspace üyeliklerini devreder.
// Idempotent — tekrar çalıştırmak zararsız.
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
const EMAIL = "oguzkir@gmail.com";

const rows = await sql`
  select id, role, created_at from users
  where lower(email) = ${EMAIL} order by created_at`;
console.log("önce:", rows);

const owner = rows.find((r) => r.role === "admin");
if (!owner) {
  console.log("admin satırı yok — dokunmuyorum.");
  process.exit(0);
}

const others = rows.filter((r) => r.id !== owner.id);
if (others.length === 0) {
  console.log("kopya satır yok — yapılacak bir şey yok.");
  process.exit(0);
}

for (const dup of others) {
  await sql`update users set role = 'admin', updated_at = now() where id = ${dup.id}`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    select wm.workspace_id, ${dup.id}, wm.role
    from workspace_members wm
    where wm.user_id = ${owner.id}
    on conflict (workspace_id, user_id) do nothing`;
  console.log(`hizalandı: ${dup.id}`);
}

console.log("sonra:", await sql`
  select id, role from users where lower(email) = ${EMAIL} order by created_at`);
console.log("üyelikler:", await sql`
  select wm.user_id, wm.role, w.name
  from workspace_members wm join workspaces w on w.id = wm.workspace_id
  where wm.user_id in (select id from users where lower(email) = ${EMAIL})
  order by wm.created_at`);
