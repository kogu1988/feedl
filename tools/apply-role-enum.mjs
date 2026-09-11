// 2026-09-11 — workspace_member_role enum göçü: 4 kademe → 3 kademe.
//   owner | admin | member | contributor  →  owner | manager | member
//
// Neden elle: `drizzle-kit migrate` Neon'da ALTER TYPE adımlarında takılıyor
// (bkz. SKILL.md), o yüzden DDL burada uygulanır.
//
// Eşleme:
//   admin       → manager   (ürün ops + üye yönetimi; billing hariç)
//   contributor → member    (ürün ops)
//   owner       → owner
//   member      → SİLİNİR   (eski `member` = portal son kullanıcısıydı; yeni
//                            `member` EKİP üyesi demek → sessiz yetki
//                            yükseltmesi olmasın diye üyelik satırı kaldırılır.
//                            Bu kullanıcılar zaten yalnız portal erişimliydi,
//                            davranışları değişmez.)
//
// Kullanım:
//   node tools/apply-role-enum.mjs           (kuru çalıştırma — hiçbir şey yazmaz)
//   node tools/apply-role-enum.mjs --apply
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const apply = process.argv.includes("--apply");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sql = neon(env.DATABASE_URL);

const [before] = await sql`
  select array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  where t.typname = 'workspace_member_role'`;
const labels = before?.labels ?? [];
console.log("mevcut enum:", JSON.stringify(labels));

// İdempotans koruması: göç zaten uygulandıysa ASLA tekrar çalıştırma —
// ikinci kez çalışırsa yeni 'member' satırlarını (gerçek ekip üyeleri) siler.
const needsMigration = labels.includes("admin") || labels.includes("contributor");
if (!needsMigration) {
  console.log("✅ göç zaten uygulanmış (admin/contributor yok) — yapılacak bir şey yok.");
  process.exit(0);
}

const memberRows = await sql`
  select count(*)::int n from workspace_members where role = 'member'`;
const memberInvites = await sql`
  select count(*)::int n from workspace_invites where role = 'member'`;
const adminRows = await sql`
  select count(*)::int n from workspace_members where role = 'admin'`;
const contributorRows = await sql`
  select count(*)::int n from workspace_members where role = 'contributor'`;

console.log("plan:");
console.log(`  admin → manager        : ${adminRows[0].n} satır`);
console.log(`  contributor → member   : ${contributorRows[0].n} satır`);
console.log(`  eski member SİLİNECEK  : ${memberRows[0].n} üye satırı, ${memberInvites[0].n} davet`);
console.log("  tip: owner|admin|member|contributor → owner|manager|member");

if (!apply) {
  console.log("\n(kuru çalıştırma — uygulamak için --apply)");
  process.exit(0);
}

const MAP = `CASE role::text WHEN 'admin' THEN 'manager' WHEN 'contributor' THEN 'member' ELSE role::text END`;

async function typeExists(name) {
  const rows = await sql.query("select 1 as x from pg_type where typname = $1", [name]);
  return rows.length > 0;
}

// Neon HTTP driver'da `sql.unsafe` güvenilmez → ALTER'ler `sql.query` literal
// olarak çalıştırılır. Adımlar sıralı ve DEVAM ETTİRİLEBİLİR: yarıda kalırsa
// yeniden çalıştırıldığında mevcut olan nesneler atlanır.
const steps = [
  ["eski member üye satırlarını sil", "delete from workspace_members where role = 'member'"],
  ["eski member davetlerini sil", "delete from workspace_invites where role = 'member'"],
];

if (!(await typeExists("workspace_member_role_new"))) {
  steps.push([
    "yeni enum tipi oluştur",
    "create type workspace_member_role_new as enum ('owner','manager','member')",
  ]);
}

steps.push(
  ["workspace_members: default kaldır", "alter table workspace_members alter column role drop default"],
  [
    "workspace_members: tip değiştir (admin→manager, contributor→member)",
    `alter table workspace_members alter column role type workspace_member_role_new using (${MAP})::workspace_member_role_new`,
  ],
  ["workspace_members: default geri koy", "alter table workspace_members alter column role set default 'member'"],
  ["workspace_invites: default kaldır", "alter table workspace_invites alter column role drop default"],
  [
    "workspace_invites: tip değiştir",
    `alter table workspace_invites alter column role type workspace_member_role_new using (${MAP})::workspace_member_role_new`,
  ],
  ["workspace_invites: default geri koy", "alter table workspace_invites alter column role set default 'member'"],
);

if (await typeExists("workspace_member_role")) {
  steps.push(["eski tipi kaldır", "drop type workspace_member_role"]);
}
steps.push([
  "yeni tipi adlandır",
  "alter type workspace_member_role_new rename to workspace_member_role",
]);

for (const [label, statement] of steps) {
  await sql.query(statement);
  console.log(`  ✓ ${label}`);
}

console.log("\nuygulandı. doğrulama:");
const [after] = await sql`
  select array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  where t.typname = 'workspace_member_role'`;
console.log("  yeni enum:", JSON.stringify(after?.labels ?? []));
const cols = await sql`
  select table_name, column_name from information_schema.columns
  where udt_name = 'workspace_member_role' order by table_name`;
console.log("  kolonlar:", JSON.stringify(cols));
const roles = await sql`
  select role, count(*)::int n from workspace_members group by role order by role`;
console.log("  roller:", JSON.stringify(roles));
