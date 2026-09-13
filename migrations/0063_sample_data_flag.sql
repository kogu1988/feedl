-- 0063 — ÖRNEK VERİ İŞARETİ (activation friction).
--
-- NEDEN (Sprint 68, glm_analyse.md §3.2 / R2):
-- Gelir skorunun anlamlı olması "şirket aç → MRR gir → fırsat gir → fikre bağla"
-- zincirini gerektiriyor; yeni bir Free kullanıcı bunu yapmadan ürünün asıl
-- değerini GÖREMİYOR. Onboarding'e "örnek veriyle dene" seçeneği ekleniyor.
--
-- NEDEN AYRI BİR KOLON: üretilen örnek satırların GERÇEK veriden ayırt
-- edilebilmesi ve TEK komutla silinebilmesi gerekir. Ad/başlık kalıbıyla
-- işaretlemek (ör. "örnek" öneki) admin içeriği düzenleyince kırılır; bayrak
-- kalıcı ve sorgulanabilirdir. Ayrıca örnek satırlar huni ölçümüne ve gerçek
-- metriklere SIZMAMALIDIR (bu bayrak onların filtrelenmesini sağlar).
--
-- NEDEN `NOT NULL DEFAULT false`: mevcut tüm satırlar gerçek veridir; varsayılan
-- geriye dönük uyumludur ve yeni satırlar açıkça işaretlenmedikçe gerçek sayılır.
--
-- Uygulama: `node tools/apply-0063.mjs` (idempotent).

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;

-- Örnek satırları gerçek veriden ayıran sorgular (silme + filtreleme) için.
CREATE INDEX IF NOT EXISTS "posts_workspace_is_sample_idx"
  ON "posts" ("workspace_id", "is_sample");
CREATE INDEX IF NOT EXISTS "companies_workspace_is_sample_idx"
  ON "companies" ("workspace_id", "is_sample");
CREATE INDEX IF NOT EXISTS "opportunities_workspace_is_sample_idx"
  ON "opportunities" ("workspace_id", "is_sample");
