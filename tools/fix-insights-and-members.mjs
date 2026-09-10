// İki veri düzeltmesi:
//  1) Bayat içgörü cache'i: free dönemde yazılmış "Pro plan özelliğidir"
//     metnini cache'ten temizle (Pro sayfada gerçek içgörü sanılmasın).
//  2) Yetim kimliği üye listesinden çıkar — Clerk'te ARTIK OLMAYAN satır.
//     Kullanıcı satırı SİLİNMEZ: 6 fikir / 34 yorum / 1 oy ona bağlı ve FK'ler
//     CASCADE (silinseydi içerik yok olurdu).
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
// Canlı Clerk kimliği (Clerk API ile doğrulandı) ve yetim satır.
const ORPHAN = "user_3Ih7nSRpCcyPj6abvmTQ1ThkjfU";

console.log("--- ÖNCE ---");
console.log("workspace:", await sql`select id, slug, plan, corpus_insights, corpus_insights_status from workspaces`);
console.log("üyeler:", await sql`
  select wm.user_id, u.email, u.role as user_role, wm.role as member_role
  from workspace_members wm join users u on u.id = wm.user_id`);

// 1) Bayat cache temizliği (içinde "Pro plan" metni geçen cache'ler).
const cleared = await sql`
  update workspaces
  set corpus_insights = null,
      corpus_insights_status = 'idle',
      updated_at = now()
  where corpus_insights::text ilike '%Pro plan%'
  returning id, slug`;
console.log("\nbayat cache temizlenen workspace:", cleared);

// 2) Yetim kimliği üye listesinden çıkar; kullanıcı satırı ve içerik korunur.
const removed = await sql`
  delete from workspace_members
  where user_id = ${ORPHAN}
  returning workspace_id, user_id`;
console.log("kaldırılan üyelik:", removed);

// Platform personeli işareti yalnız CANLI kimlikte kalsın.
const demoted = await sql`
  update users set role = 'customer', updated_at = now()
  where id = ${ORPHAN} and role = 'admin'
  returning id, role`;
console.log("platform işareti düşürülen (yetim) satır:", demoted);

console.log("\n--- SONRA ---");
console.log("workspace:", await sql`select slug, plan, corpus_insights, corpus_insights_status from workspaces`);
console.log("üyeler:", await sql`
  select wm.user_id, u.email, u.role as user_role, wm.role as member_role
  from workspace_members wm join users u on u.id = wm.user_id`);
console.log("yetim satırın içeriği korunuyor mu:", await sql`
  select
    (select count(*)::int from posts where user_id = ${ORPHAN}) as posts,
    (select count(*)::int from comments where user_id = ${ORPHAN}) as comments,
    (select count(*)::int from votes where user_id = ${ORPHAN}) as votes`);
