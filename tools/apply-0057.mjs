// Migration 0057 uygulayıcı — drizzle-kit migrate Neon'da takıldığı için DDL
// literal olarak çalıştırılır (bkz. 0052–0056 için aynı yaklaşım).
//
// Kullanıcı silindiğinde içerik kurtarma: `posts.user_id` ve
// `comments.user_id` CASCADE → SET NULL (+ nullable). Ayrıntılı gerekçe:
// migrations/0057_anonymize_author_on_user_delete.sql
//
// IDEMPOTENT: FK zaten SET NULL ise dokunmaz; tekrar çalıştırılabilir.
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

// confdeltype: c=CASCADE, n=SET NULL, a=NO ACTION, r=RESTRICT, d=SET DEFAULT
async function currentFk(table, column) {
  const rows = await sql.query(
    `select con.conname, con.confdeltype
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_attribute att
         on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
      where con.contype = 'f' and rel.relname = $1 and att.attname = $2`,
    [table, column],
  );
  return rows[0] ?? null;
}

async function ensureSetNull(table, column) {
  // NOT NULL'u kaldırmak idempotenttir (zaten nullable ise hata vermez).
  await sql.query(`alter table "${table}" alter column "${column}" drop not null`);
  const fk = await currentFk(table, column);
  if (fk && fk.confdeltype === "n") {
    return `already SET NULL (${fk.conname})`;
  }
  if (fk) {
    await sql.query(`alter table "${table}" drop constraint "${fk.conname}"`);
  }
  const name = fk?.conname ?? `${table}_${column}_users_id_fk`;
  await sql.query(
    `alter table "${table}" add constraint "${name}"
       foreign key ("${column}") references "users"("id") on delete set null`,
  );
  return `CASCADE → SET NULL (${name})`;
}

console.log("posts.user_id   :", await ensureSetNull("posts", "user_id"));
console.log("comments.user_id:", await ensureSetNull("comments", "user_id"));

console.log("\n✅ 0057 applied — doğrulama:");
console.table(
  await sql.query(
    `select rel.relname as tbl, att.attname as col, att.attnotnull,
            con.conname, con.confdeltype
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_attribute att
         on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
      where con.contype = 'f' and rel.relname in ('posts','comments')
        and att.attname in ('user_id','parent_id')
      order by rel.relname, att.attname`,
  ),
);
