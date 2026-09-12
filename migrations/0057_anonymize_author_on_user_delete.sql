-- 0057 — Kullanıcı silindiğinde içerik KORUNUR (yazar anonimleştirilir).
--
-- NEDEN (2026-09-12 kıdemli denetimi, bulgu K4):
-- `posts.user_id` ve `comments.user_id` FK'ları `ON DELETE CASCADE` idi. Clerk
-- `user.deleted` webhook'u `delete from users` çalıştırdığı için, bir kullanıcı
-- hesabını silince:
--   1) yazdığı FİKİRLER siliniyordu,
--   2) cascade zinciriyle o fikirlerdeki BAŞKA KULLANICILARIN oyları ve
--      yorumları da yok oluyordu.
-- Yani 50 oy almış bir özellik talebi, onu açan kişi hesabını sildiği için
-- siliniyordu — workspace sahibi bunu ne onaylar ne geri alabilir.
--
-- GDPR silme hakkı kişisel veriye uygulanır; başkalarının içeriği feda edilmez.
-- Doğru model: yazar bağlantısı düşer (`SET NULL`), içerik ve topluluk verisi
-- (oylar/yorumlar) kalır; UI "Silinmiş kullanıcı" gösterir.
--
-- KAPSAM NOTU: `comments.parent_id` cascade'i DEĞİŞTİRİLMEZ. Bir yazarın kendi
-- yorumunu silmesi yanıtlarını da götürmesi kasıtlı tasarım kararıdır (bkz.
-- lib/db/schema.ts Sprint 24 notu); burada düzeltilen şey hesap silmenin YAN
-- ETKİSİDİR.
--
-- Uygulama: `node tools/apply-0057.mjs` (idempotent).

ALTER TABLE "posts" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_user_id_users_id_fk";
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "comments" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_user_id_users_id_fk";
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
