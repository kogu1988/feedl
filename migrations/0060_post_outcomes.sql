-- 0060 — OUTCOME KAYDI: yayınlanan bir fikrin GERÇEKLEŞEN sonucu.
--
-- NEDEN (M6 ürün eksiği, 2026-09-12):
-- `docs/FEEDL-ROADMAP.md` M6 çıkış kriterlerinden "outcome kaydı yapılabiliyor"
-- karşılanmıyordu: shipped bir fikrin sonucunu (genişleme / elde tutma /
-- verimlilik + gelir etkisi) kaydedecek alan YOKTU. Ürün "ne yaptık?" sorusunu
-- cevaplıyor, "işe yaradı mı?" sorusunu cevaplayamıyordu.
--
-- Neden `posts`e kolon eklemek yerine AYRI TABLO: aynı fikir zaman içinde
-- birden fazla sonuç üretebilir (+$80K genişleme, ardından bir yenileme).
-- Tek kolonla bu geçmiş kaybolurdu; H10'un "historical outcome data moat"ı
-- tam olarak bu birikimdir.
--
-- Neden `workspace_id` ayrıca tutulur: `post_id` üzerinden de scope'lanabilirdi,
-- ama gelir verisi taşıyan tablolarda (companies/opportunities) tenant kolonu
-- doğrudan durur — tek filtreyi unutan bir sorgu sızıntıya dönüşmesin.
--
-- Uygulama: `node tools/apply-0060.mjs` (idempotent).

CREATE TABLE IF NOT EXISTS "post_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "outcome_type" varchar(30) NOT NULL,
  "revenue_delta" numeric(12, 2),
  "summary" text NOT NULL,
  "evidence_url" text,
  "occurred_at" date,
  "recorded_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Kısıtlar drizzle adlandırma kuralıyla eklenir (ileride şema diff'i temiz
-- kalsın); ADD CONSTRAINT idempotent olmadığı için varlık kontrolü yapılır.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_workspace_id_workspaces_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_workspace_id_workspaces_id_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_post_id_posts_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_post_id_posts_id_fk"
      FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_outcomes_recorded_by_users_id_fk'
  ) THEN
    ALTER TABLE "post_outcomes" ADD CONSTRAINT "post_outcomes_recorded_by_users_id_fk"
      FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "post_outcomes_post_idx"
  ON "post_outcomes" ("post_id");
CREATE INDEX IF NOT EXISTS "post_outcomes_workspace_idx"
  ON "post_outcomes" ("workspace_id");
