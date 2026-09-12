-- 0061 — Varsayılan workspace'in görünen adı.
--
-- Sorun: seed ile gelen varsayılan (`feedl`) workspace'in adı literal olarak
-- "workspace" idi. Kök host'ta marka artık her zaman feedl olduğu için bu ad
-- kök host'ta görünmez; AMA dashboard'da aktif-workspace çipi bu adı gösterir
-- ve "workspace" yazan bir çip anlamsızdır.
--
-- IDEMPOTENT ve DAR: yalnız slug='feedl' satırının adını düzeltir; başka
-- workspace'e dokunmaz. Kullanıcı daha sonra arayüzden yeniden adlandırabilir.
--
-- Kullanım: node tools/apply-0061.mjs
UPDATE "workspaces"
   SET "name" = 'feedl'
 WHERE "slug" = 'feedl'
   AND "name" <> 'feedl';
