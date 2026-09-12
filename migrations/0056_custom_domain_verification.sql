-- 2026-09-12 kod incelemesi — custom domain SAHİPLİK DOĞRULAMASI.
--
-- Sorun: `workspaces.custom_domain` herhangi bir workspace owner'ı tarafından
-- serbestçe yazılabiliyordu (biçim doğrulaması bile yoktu) ve
-- `resolveWorkspaceByHost` bu alanı subdomain→slug'dan ÖNCE eşliyordu. Bir
-- tenant `feedback.acme.com`'u kapıp, acme sonradan DNS'ini feedl'e çevirdiğinde
-- gelen trafik o tenant'ın workspace'i olarak servis edilirdi.
--
-- Çözüm: (1) hostname biçim doğrulaması, (2) aynı hostname'i iki workspace
-- kapamaz (unique index), (3) `_feedl.<domain>` TXT kaydı doğrulanmadan domain
-- host çözümlemesinde KULLANILMAZ (custom_domain_verified_at).
--
-- Not: bu repoda DDL elle uygulanır (drizzle-kit migrate Neon'da takılıyor);
-- uygulayıcı: tools/apply-0056.mjs

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "custom_domain_verification_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "custom_domain_verified_at" timestamp with time zone;
--> statement-breakpoint
-- Postgres'te NULL'lar tekil sayılmaz → birden çok boş custom_domain sorun değil.
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_custom_domain_key" ON "workspaces" USING btree ("custom_domain");
