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

// Çok kelimeli arama (plan.md Sprint 8): her token başlıkta VEYA açıklamada
// geçmeli (AND) — kelime sırası önemsiz. Skor: başlık eşleşmesi 2 puan,
// açıklama 1 puan; relevance sıralaması bunun üzerinden yapılır.
export function buildPostSearch(rawQuery: string): PostSearch {
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

  const condition = sql.join(
    patterns.map(
      (pattern) =>
        sql`(${foldTitle} like ${pattern} or ${foldDescription} like ${pattern})`,
    ),
    sql` and `,
  );

  const score = sql.join(
    patterns.map(
      (pattern) =>
        sql`(case when ${foldTitle} like ${pattern} then 2 else 0 end) + (case when ${foldDescription} like ${pattern} then 1 else 0 end)`,
    ),
    sql` + `,
  );

  return { tokens, condition, score };
}
