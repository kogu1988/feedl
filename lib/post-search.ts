import { sql, type SQL } from "drizzle-orm";

import { posts } from "@/lib/db/schema";

// Türkçe diakritik katlaması — "karanlik" araması "karanlık" başlığıyla da
// eşleşir (ve tersi). SQL tarafındaki translate+lower ile JS tarafındaki
// foldTr birebir aynı eşlemeyi uygulamak zorunda; biri değişirse diğeri de
// değişmeli. İ/I doğrudan 'i'ye çevrilir: lower() davranışı yerel ayara
// göre değişebildiğinden lower hiçbir zaman I/İ görmesin.
const TR_FOLD_SOURCE = "çğıöşüİIÇĞÖŞÜ";
const TR_FOLD_TARGET = "cgiosuiicgiosu";

const TR_FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  İ: "i",
  I: "i",
  Ç: "c",
  Ğ: "g",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

export function foldTr(text: string): string {
  return text
    .replace(/[çğıöşüİIÇĞÖŞÜ]/g, (char) => TR_FOLD_MAP[char] ?? char)
    .toLowerCase();
}

// LIKE jokerlerini kaçır. Ters eğik çizgi EN ÖNCE kaçılmalı; aksi halde
// \% gibi kaçış çiftlerinin kendisi bozulur.
function likeEscape(token: string): string {
  return token
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

// Tek sorguda aşırı token birikmesini engelle: 100 karakterlik girdi bile
// ~20 kelime üretebilir; 8 token arama kalitesini korumak için yeterli.
const MAX_SEARCH_TOKENS = 8;

// Hibrit ağırlıklar (Sprint 27): fold-ILIKE eşleşmesi en güçlü sinyal
// (tam alt dizge), FTS kök bulma ikinci, trigram yazım toleransı üçüncü,
// vektör (anlamsal) dördüncü. Skorlar birbirine yakın büyüklükte kalsın.
const W_FTS = 6;
const W_TRIGRAM = 4;
const W_VECTOR = 3;

function foldExpression(
  column: typeof posts.title | typeof posts.description,
): SQL {
  return sql`lower(translate(${column}, ${TR_FOLD_SOURCE}, ${TR_FOLD_TARGET}))`;
}

export interface PostSearch {
  tokens: string[];
  condition: SQL | undefined;
  score: SQL;
}

// Sprint 27 hibrit arama: (1) mevcut fold-ILIKE (tam alt dizge, Türkçe
// katlamalı), (2) PostgreSQL full-text tsvector ('turkish' config, kök
// bulma), (3) pg_trgm benzerliği (yazım hatası toleransı), (4) opsiyonel
// sorgu embedding'i ile pgvector anlamsal benzerlik. Koşul: fold-AND veya
// FTS eşleşmesi; skor: dördünün ağırlıklı toplamı — tek kaynak
// lib/post-search.ts kalır (portal + /api/posts aynı fonksiyonu kullanır).
export function buildPostSearch(
  rawQuery: string,
  queryEmbedding?: number[],
): PostSearch {
  const tokens = foldTr(rawQuery)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TOKENS);

  if (tokens.length === 0) {
    return { tokens, condition: undefined, score: sql`0` };
  }

  const foldTitle = foldExpression(posts.title);
  const foldDescription = foldExpression(posts.description);
  const patterns = tokens.map((token) => `%${likeEscape(token)}%`);

  const foldCondition = sql.join(
    patterns.map(
      (pattern) =>
        sql`(${foldTitle} like ${pattern} or ${foldDescription} like ${pattern})`,
    ),
    sql` and `,
  );

  // FTS: websearch_to_tsquery güvenlidir (sözdizimi hataları yok); 'turkish'
  // config kök bulma yapar ("kayıtları" -> "kayıt"). Boş tsquery hiçbir
  // şeyle eşleşmez — bu durumda foldCondition tek başına karar verir.
  const tsQuery = sql`websearch_to_tsquery('turkish', ${rawQuery.trim()})`;
  const ftsCondition = sql`${posts.searchVector} @@ ${tsQuery}`;

  const condition = sql`(${foldCondition} or ${ftsCondition})`;

  const foldScore = sql.join(
    patterns.map(
      (pattern) =>
        sql`(case when ${foldTitle} like ${pattern} then 2 else 0 end) + (case when ${foldDescription} like ${pattern} then 1 else 0 end)`,
    ),
    sql` + `,
  );

  const ftsScore = sql`(ts_rank(${posts.searchVector}, ${tsQuery}) * ${W_FTS})`;

  const trigramScore = sql`(
    similarity(
      lower(${posts.title} || ' ' || ${posts.description}),
      lower(${rawQuery.trim()})
    ) * ${W_TRIGRAM}
  )`;

  // Vektör: yalnızca sorgu embedding'i 2048 boyutla geldiğinde katılır;
  // embedding'siz fikirlerde mesafe null -> coalesce ile 0.
  const vectorScore = queryEmbedding
    ? sql`(coalesce(1 - (${posts.embeddingVector} <=> ${`[${queryEmbedding.join(",")}]`}::vector), 0) * ${W_VECTOR})`
    : sql`0`;

  return {
    tokens,
    condition,
    score: sql`(${foldScore} + ${ftsScore} + ${trigramScore} + ${vectorScore})`,
  };
}
