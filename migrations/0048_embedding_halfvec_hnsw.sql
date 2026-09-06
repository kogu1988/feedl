-- B5: posts.embedding_vector vector(2048) → halfvec(2048).
-- pgvector HNSW cap 2000'i vector(2048) ile aşamayız; halfvec'ta indexlenebilir.
-- Postgres otomatik cast YAPMAZ — explicit USING gerekli (vector::halfvec cast var).
ALTER TABLE "posts" ALTER COLUMN "embedding_vector" SET DATA TYPE halfvec(2048)
USING "embedding_vector"::halfvec;

-- HNSW index — `<=>` cosine mesafesi kullandığımız için halfvec_cosine_ops.
CREATE INDEX IF NOT EXISTS "posts_embedding_hnsw_idx" ON "posts" USING hnsw ("embedding_vector" halfvec_cosine_ops);
