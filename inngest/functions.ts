import { eq, sql } from "drizzle-orm";

import { analyzeIdea, compareIdeas } from "@/lib/ai/analysis";
import { embedText } from "@/lib/ai/openrouter";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import {
  postCreatedEventSchema,
  type PostCreatedEvent,
} from "@/lib/validations/ai";
import { inngest } from "./client";

// plan.md Sprint 5: cosine adayları LLM ile çift doğrulanır (prompts.md §2);
// LLM "DUPLICATE" derse yeni post duplicate işaretlenir. Eşik 0.85 değil:
// nemotron-3-embed-1b canlı testlerinde benzer Türkçe postlar 0.57-0.80 arası
// skor üretti (ada-002 kalibrasyonu bu model için geçerli değil) — 0.60
// pragmatik başlangıç, LLM doğrulaması yanlış pozitifleri eler.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;
const DUPLICATE_CANDIDATE_LIMIT = 5;

interface DuplicateCandidate {
  id: string;
  title: string;
  description: string;
  similarity: number;
}

// neon-http üzerindeki drizzle execute() sonucu sürüme göre ya satır dizisi
// ya da { rows } zarfı döndürebilir; ikisini de normalize et.
function extractRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (
    result !== null &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

export const aiAutopilot = inngest.createFunction(
  { id: "ai-autopilot", retries: 2, triggers: { event: "post/created" } },
  async ({ event, step }) => {
    const payload: PostCreatedEvent = postCreatedEventSchema.parse(event.data);

    // 1) Yeni postun metnini vektöre çevir.
    const embedding: number[] = await step.run(
      "generate-embedding",
      async () => {
        const vector = await embedText(
          `${payload.title}\n${payload.description}`,
        );
        if (vector.length !== 2048) {
          throw new Error(`Unexpected embedding dimension: ${vector.length}`);
        }
        return vector;
      },
    );

    // 2) En benzer eski postu bul (cosine, HNSW yok — sıralı tarama yeterli).
    const candidate: DuplicateCandidate | null = await step.run(
      "find-duplicate-candidate",
      async () => {
        const vectorLiteral = `[${embedding.join(",")}]`;
        const result = await getDb().execute(sql`
          SELECT id, title, description,
                 1 - (embedding_vector <=> ${vectorLiteral}::vector) AS similarity
          FROM posts
          WHERE embedding_vector IS NOT NULL AND id <> ${payload.postId}
          ORDER BY embedding_vector <=> ${vectorLiteral}::vector
          LIMIT ${DUPLICATE_CANDIDATE_LIMIT}
        `);

        const mapped: DuplicateCandidate[] = [];
        for (const row of extractRows(result)) {
          const similarity = Number(row.similarity);
          if (
            typeof row.id === "string" &&
            typeof row.title === "string" &&
            typeof row.description === "string" &&
            Number.isFinite(similarity)
          ) {
            mapped.push({
              id: row.id,
              title: row.title,
              description: row.description,
              similarity,
            });
          }
        }

        const best = mapped.sort((a, b) => b.similarity - a.similarity)[0];
        return best && best.similarity > DUPLICATE_SIMILARITY_THRESHOLD
          ? best
          : null;
      },
    );

    let duplicateOf: string | null = null;
    let duplicateNote: string | null = null;

    // 3) Aday varsa LLM ile çift doğrula; %90+ aynıysa duplicate işaretle.
    if (candidate) {
      const relation = await step.run(
        "confirm-duplicate-with-llm",
        async () =>
          compareIdeas(
            { title: candidate.title, description: candidate.description },
            { title: payload.title, description: payload.description },
          ),
      );

      if (relation === "DUPLICATE") {
        duplicateOf = candidate.id;
        duplicateNote = `Bu istek #${candidate.id} ile yüksek olasılıkla tekrar (duplicate, cosine ${candidate.similarity.toFixed(3)})`;
      }
    }

    // 4) Özet + sentiment + etiketler.
    const analysis = await step.run("analyze-idea", async () =>
      analyzeIdea({ title: payload.title, description: payload.description }),
    );

    // 5) Tüm sonuçları tek yazımda kaydet.
    await step.run("persist-ai-results", async () => {
      await getDb()
        .update(posts)
        .set({
          aiSummary: analysis.summary,
          sentimentLabel: analysis.sentiment,
          aiKeywords: analysis.keywords,
          embeddingVector: embedding,
          ...(duplicateOf ? { duplicateOf, duplicateNote } : {}),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, payload.postId));
    });

    return { duplicateOf, sentiment: analysis.sentiment };
  },
);
