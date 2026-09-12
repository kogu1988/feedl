// `prove-ai-alert.mjs` provasının yan etkilerini denetler/temizler.
//
// Neden gerekli: ilk provada (9016 karakter) gömme BAŞARILI oldu (sınır daha
// yüksekmiş), bu yüzden ai-autopilot zinciri sonuna kadar koştu ve `sync-tags`
// adımı — var olmayan postId yüzünden `post_tags` FK ihlaliyle ölürken —
// `tags` tablosuna satır(lar) bıraktı. Bu betik o artıkları bulur.
//
// Kullanım:
//   node tools/cleanup-ai-probe.mjs                      # rapor (varsayılan)
//   node tools/cleanup-ai-probe.mjs --apply              # sahipsiz tag'leri sil
//   node tools/cleanup-ai-probe.mjs --post=<uuid>        # belirli postId'yi denetle
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const apply = process.argv.includes("--apply");
const postArg = process.argv.slice(2).find((a) => a.startsWith("--post="));

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

// 1) Sağlanan postId herhangi bir tabloda iz bırakmış mı? (FK'li kolonları tara)
if (postArg) {
  const postId = postArg.split("=")[1];
  const fks = await sql.query(
    `select tc.table_name, kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_name = 'posts' and ccu.column_name = 'id'
      order by tc.table_name`,
  );
  console.log(`posts.id'ye bakan ${fks.length} FK kolonunda ${postId} aranıyor...`);
  let hits = 0;
  for (const fk of fks) {
    try {
      const res = await sql.query(
        `select count(*)::int n from ${fk.table_name} where ${fk.column_name} = $1`,
        [postId],
      );
      if (res[0]?.n > 0) {
        console.log(`  ⚠️  ${fk.table_name}.${fk.column_name}: ${res[0].n} satır`);
        hits += res[0].n;
      }
    } catch {
      /* kolon tipi uyuşmazsa atla */
    }
  }
  console.log(hits === 0 ? "  ✅ hiç iz yok" : `  ⚠️  toplam ${hits} satır bulundu`);
}

// 2) Yakın zamanda oluşmuş, hiçbir post'a bağlı OLMAYAN tag'ler (prova artığı).
const tags = await sql.query(
  `select t.id, t.name, t.workspace_id, t.created_at,
          (select count(*)::int from post_tags pt where pt.tag_id = t.id) as usage
     from tags t
    where t.created_at > now() - interval '6 hours'
    order by t.created_at desc`,
);
console.log(`\nson 6 saatte oluşan tag: ${tags.length}`);
for (const t of tags) {
  console.log(
    `  ${t.created_at.toISOString?.() ?? t.created_at}  ${t.name}  (kullanım: ${t.usage})`,
  );
}
const orphans = tags.filter((t) => t.usage === 0);
console.log(`\nsahipsiz (0 kullanım): ${orphans.length}`);
if (orphans.length === 0) process.exit(0);
if (!apply) {
  console.log("(silmek için --apply)");
  process.exit(0);
}
for (const t of orphans) {
  await sql.query(`delete from tags where id = $1`, [t.id]);
  console.log(`  🗑️  silindi: ${t.name}`);
}
