// Yetim kullanıcı satırının içeriğini CANLI Clerk kimliğine taşır.
//
// Bağlam: Clerk'te artık var olmayan `user_3Ih7n…` satırı tüm geçmiş içeriği
// tutuyor (6 fikir / 34 yorum / 1 oy); canlı kimlik `user_3IycZ…`. İkisi de
// aynı doğrulanmış e-posta → aynı kişi. Amaç: içeriği canlı kimliğe taşıyıp
// yetim satırı kaldırmak.
//
// Varsayılan KURU ÇALIŞTIRMA. Uygulamak için: --apply
import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const ORPHAN = "user_3Ih7nSRpCcyPj6abvmTQ1ThkjfU"; // Clerk'te yok
const LIVE = "user_3IycZ06AWPMcWs6IUXY5eAnVzoa"; // canlı oturum

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

console.log(`mod: ${APPLY ? "UYGULA" : "KURU ÇALIŞTIRMA"}\n`);

// ── 1) users.id'ye atıfta bulunan TÜM kolonlar ────────────────────────────
const fkCols = await sql`
  select tc.table_name as t, kcu.column_name as c, rc.delete_rule as rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and ccu.table_name = 'users' and ccu.column_name = 'id'`;

// FK olmasa da kullanıcı id'si tutan kolon var mı? (isimden sezgisel tarama)
const nameCandidates = await sql`
  select table_name as t, column_name as c
  from information_schema.columns
  where table_schema = 'public'
    and data_type in ('text','character varying')
    and (column_name = 'user_id' or column_name like '%_user_id'
         or column_name in ('created_by','decided_by','owner_id','accepted_by'))
  order by table_name, column_name`;
const fkSet = new Set(fkCols.map((f) => `${f.t}.${f.c}`));
const unconstrained = nameCandidates.filter((n) => !fkSet.has(`${n.t}.${n.c}`));
console.log("FK ile korunan kolon:", fkCols.length);
console.log("FK'sız ama kullanıcı id'si tutuyor olabilecek kolon:", unconstrained.length);
if (unconstrained.length) console.log("  ", unconstrained.map((u) => `${u.t}.${u.c}`).join(", "));

// ── 2) Taşınacak satırlar + çakışma tespiti ───────────────────────────────
// Tekillik: (a) kolonun dahil olduğu UNIQUE index'ler, (b) canlı kimlikte
// aynı anahtara sahip satır varsa çakışma olur.
const uniqueIdx = await sql`
  select t.relname as t, i.relname as idx, a.attname as col,
         array_position(ix.indkey, a.attnum) as pos
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any(ix.indkey)
  where ix.indisunique and n.nspname = 'public'`;

console.log("\n--- taşınacak satırlar ---");
// Taşınacak kolon kümesi: FK korumalı olanlar + FK'sız ama kullanıcı id'si
// tutanlar (ör. widget_triages.user_id).
const moveCols = [...fkCols, ...unconstrained];
let totalMoved = 0;
for (const { t, c } of moveCols) {
  const orphanN = await sql.query(`select count(*)::int n from ${t} where ${c} = '${ORPHAN}'`);
  const liveN = await sql.query(`select count(*)::int n from ${t} where ${c} = '${LIVE}'`);
  if (orphanN[0].n === 0) continue;

  // Bu kolonu içeren UNIQUE index var mı? Varsa canlı tarafla çakışma riski.
  const idxs = uniqueIdx.filter((u) => u.t === t && u.col === c);
  let conflicts = 0;
  let note = "";
  if (idxs.length > 0) {
    const idx = idxs[0];
    const allCols = uniqueIdx.filter((u) => u.idx === idx.idx).map((u) => u.col);
    const others = allCols.filter((k) => k !== c);
    // Aynı diğer-kolon değerleriyle hem yetimde hem canlıda satır var mı?
    const q = `select count(*)::int n from ${t} o
               join ${t} l on ${others.map((k) => `o.${k} = l.${k}`).join(" and ")}
               where o.${c} = '${ORPHAN}' and l.${c} = '${LIVE}'`;
    conflicts = (await sql.query(q))[0].n;
    note = `unique(${allCols.join(",")}) → çakışma: ${conflicts}`;
  } else {
    note = "unique kısıt yok";
  }
  totalMoved += orphanN[0].n;
  console.log(
    `  ${t}.${c}: yetim ${orphanN[0].n} → canlı (canlıda ${liveN[0].n} var) | ${note}`,
  );
}
console.log(`toplam taşınacak satır: ${totalMoved}`);

// ── 3) Uygula ─────────────────────────────────────────────────────────────
if (APPLY) {
  // Geri dönüş yedeği: taşınacak satırları OLDUĞU GİBİ kaydet. Silme geri
  // alınamaz olduğu için bu olmadan uygulamak sorumsuzluk olurdu.
  const backup = {};
  for (const { t, c } of moveCols) {
    const rows = await sql.query(`select * from ${t} where ${c} = '${ORPHAN}'`);
    if (rows.length > 0) backup[`${t}.${c}`] = rows;
  }
  backup.__meta = { orphan: ORPHAN, live: LIVE, at: new Date().toISOString() };
  const backupPath = `tools/merge-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nyedek yazıldı: ${backupPath}`);

  console.log("\n--- UYGULANIYOR ---");
  for (const { t, c } of moveCols) {
    // Çakışan satırlar önce silinir (yetimdekinin aynısı canlıda varsa
    // ikinci satır gereksizdir; içerik kaybı olmaz).
    const idxs = uniqueIdx.filter((u) => u.t === t && u.col === c);
    let deduped = 0;
    if (idxs.length > 0) {
      const allCols = uniqueIdx.filter((u) => u.idx === idxs[0].idx).map((u) => u.col);
      const others = allCols.filter((k) => k !== c);
      if (others.length > 0) {
        const res = await sql.query(
          `delete from ${t} o
           using ${t} l
           where o.${c} = '${ORPHAN}' and l.${c} = '${LIVE}'
             and ${others.map((k) => `o.${k} = l.${k}`).join(" and ")}
           returning o.${others[0]}`,
        );
        deduped = res.length;
      }
    }
    const moved = await sql.query(
      `update ${t} set ${c} = '${LIVE}' where ${c} = '${ORPHAN}' returning 1`,
    );
    console.log(`  ${t}.${c}: ${moved.length} taşındı${deduped ? `, ${deduped} çakışan silindi` : ""}`);
  }

  // Yetim satıra kalan referans var mı? Yoksa satırı sil.
  const remaining = [];
  for (const { t, c } of moveCols) {
    const n = (await sql.query(`select count(*)::int n from ${t} where ${c} = '${ORPHAN}'`))[0].n;
    if (n > 0) remaining.push(`${t}.${c}=${n}`);
  }
  if (remaining.length > 0) {
    console.log("\n⚠️ hâlâ referans var, satır SİLİNMEDİ:", remaining.join(", "));
  } else {
    const del = await sql`delete from users where id = ${ORPHAN} returning id`;
    console.log(`\nyetim satır silindi: ${del.length === 1 ? "✅ evet" : "❌ hayır"}`);
  }
}

// ── 4) Son durum ──────────────────────────────────────────────────────────
console.log("\n--- son durum ---");
console.log(
  "kalan kullanıcılar:",
  await sql`select id, role from users where lower(email)='oguzkir@gmail.com'`,
);
console.log(
  "canlı kimliğin içeriği:",
  await sql`
    select
      (select count(*)::int from posts where user_id = ${LIVE}) as posts,
      (select count(*)::int from comments where user_id = ${LIVE}) as comments,
      (select count(*)::int from votes where user_id = ${LIVE}) as votes,
      (select count(*)::int from workspace_members where user_id = ${LIVE}) as memberships`,
);
