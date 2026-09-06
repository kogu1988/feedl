-- Sprint 63h — pg_trgm extension + trigram arama index'i.
-- lib/post-search.ts, `word_similarity()` ile yazım hatası toleranslı arama
-- yapar (4+ harflik token'larda `> 0.55`). Bu, pg_trgm extension'ını ve
-- folded (Türkçe diakritik katlanmış) title+description ifadesi üzerinde GIN
-- trigram index'ini gerektirir — yeni ortamda elle kurulmak zorunda kalmasın.
-- foldExpression ile BİREBİR aynı ifade kullanılır:
--   lower(translate(col, 'çğıöşüİIÇĞÖŞÜ', 'cgiosuiicgiosu'))
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_search_trgm_idx" ON "posts" USING gin ((
  lower(translate("title", 'çğıöşüİIÇĞÖŞÜ', 'cgiosuiicgiosu')) ||
  ' ' ||
  lower(translate("description", 'çğıöşüİIÇĞÖŞÜ', 'cgiosuiicgiosu'))
) gin_trgm_ops);
