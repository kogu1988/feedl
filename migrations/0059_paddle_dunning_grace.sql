-- 0059 — Dunning grace: ödeme sorununda Pro ANINDA kesilmesin.
--
-- NEDEN (2026-09-12 kıdemli denetimi, bulgu K3):
-- `derivePlanFromStatus` `past_due`/`dunned` durumlarını ANINDA `free`'ye
-- çeviriyordu. Yani kartı geçmeyen müşteri, Paddle daha yeniden denemeye fırsat
-- bulamadan Pro'yu kaybediyordu: entegrasyonları durur, custom domain'i düşer,
-- private board'ları görünmez olur. Sektör standardı 7–14 günlük grace'tir.
--
-- Çözüm: ödeme sorununun NE ZAMAN başladığını sakla ve planı okuma anında
-- hesapla (süre bitince cron'a ihtiyaç kalmasın — hiçbir webhook tetiklenmez).
--
-- Uygulama: `node tools/apply-0059.mjs` (idempotent).

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "paddle_status_changed_at" timestamp with time zone;
