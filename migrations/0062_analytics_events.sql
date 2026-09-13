-- 0062 — BİRİNCİ TARAF ÜRÜN ANALİTİĞİ: aktivasyon hunisi olayları.
--
-- NEDEN (Sprint 65, glm_analyse.md §3.3):
-- `docs/FEEDL-ROADMAP.md` §4'te 13 adımlı bir funnel tanımlı ama kodda bunların
-- HİÇBİRİ ölçülmüyordu — yalnız GA page_view vardı. Ölçüm olmadan hiçbir ürün
-- değişikliğinin etkisi görülemez; "kimse Pro'ya neden geçmiyor?" sorusu
-- cevapsız kalır.
--
-- NEDEN GA4 değil de kendi tablo:
--   1) Ad-blocker / gizlilik tarayıcıları client olaylarını düşürür → huni eksik.
--   2) 3. taraf bağımlılığı ve vendor lock olmadan sorgulanabilirlik.
--   3) PII kontrolü bizde: yalnız id + sayısal/bool prop yazılır (bkz. lib/analytics).
--   4) Neon'da satır başına maliyet ihmal edilebilir (Hobby).
-- GA4, YALNIZ anonim üst-funnel (visitor) için ayrıca mirror edilir (client).
--
-- NEDEN workspace_id ayrıca tutulur: olaylar workspace kapsamlı sorgulanır
-- (ör. "bu workspace hangi adımda düştü?"); join'le scope'lamaya güvenmek
-- gelir verisi tablolarındaki desenle aynı sızıntı sınıfını davet ederdi.
--
-- Uygulama: `node tools/apply-0062.mjs` (idempotent).

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "user_id" text,
  "name" varchar(60) NOT NULL,
  "props" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Kısıtlar drizzle adlandırma kuralıyla eklenir (ileride şema diff'i temiz
-- kalsın); ADD CONSTRAINT idempotent olmadığı için varlık kontrolü yapılır.
-- workspace_id CASCADE: workspace silinince olayları da gider (GDPR self-servis
-- silme akışıyla tutarlı). user_id SET NULL: içerik/olay kalır, kişi bağlantısı
-- düşer (Clerk user.deleted anonimleştirme politikasıyla aynı — bkz. 0057).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_workspace_id_workspaces_id_fk'
  ) THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_workspace_id_workspaces_id_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

-- Huni sorguları "adım başına sayı" ve "zaman penceresi" üzerinden gider.
CREATE INDEX IF NOT EXISTS "analytics_events_name_created_idx"
  ON "analytics_events" ("name", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_workspace_created_idx"
  ON "analytics_events" ("workspace_id", "created_at");
