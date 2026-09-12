-- 0058 — Eksik index: `companies(workspace_id)`.
--
-- NEDEN (2026-09-12 kıdemli denetimi):
-- `companies` tablosunda HİÇ index yoktu — `workspace_id` dahil. Oysa bu tablo
-- gelir skoru sıcak yolunda: `revenueScoreOrderSql` (lib/db/revenue-scores.ts)
-- her fikir satırı için `companies`e workspace filtresiyle JOIN atıyor, ve
-- `loadPostImpactContexts` / `loadCustomerCounts` de aynı filtreyi kullanıyor.
-- Index olmadan bu, satır sayısı arttıkça sequential scan'e döner.
--
-- Uygulama: `node tools/apply-0058.mjs` (idempotent).

CREATE INDEX IF NOT EXISTS "companies_workspace_idx" ON "companies" ("workspace_id");
