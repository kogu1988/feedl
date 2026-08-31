import { eq, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { analyzeIdea, compareIdeas } from "@/lib/ai/analysis";
import { embedText } from "@/lib/ai/openrouter";
import { sendEmails } from "@/lib/email/send";
import { renderShippedEmail } from "@/lib/email/shipped";
import { getDb } from "@/lib/db";
import { posts, users, votes } from "@/lib/db/schema";
import {
  postCreatedEventSchema,
  postStatusChangedEventSchema,
  type PostCreatedEvent,
  type PostStatusChangedEvent,
} from "@/lib/validations/events";
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

// plan.md Sprint 6: durum "shipped"e geçince postun yazarına ve oy veren
// herkese bildirim gider. Diğer durum değişimlerinde sessizce çıkılır; event
// her değişimde tetiklenir ancak e-posta yalnızca shipped'e geçiştir.
export const notifyShipped = inngest.createFunction(
  { id: "notify-shipped", retries: 3, triggers: { event: "post/status.changed" } },
  async ({ event, step }) => {
    const payload: PostStatusChangedEvent = postStatusChangedEventSchema.parse(
      event.data,
    );

    if (payload.newStatus !== "shipped") {
      return { skipped: true, newStatus: payload.newStatus };
    }

    // 1) Post + alıcılar (yazar + oy verenler, tekil). E-postalar loglanmaz.
    const recipients = await step.run("fetch-recipients", async () => {
      const [post] = await getDb()
        .select({ id: posts.id, title: posts.title, authorId: posts.userId })
        .from(posts)
        .where(eq(posts.id, payload.postId))
        .limit(1);

      if (!post) {
        // Post silinmişse retry anlamsız — tekrar denemeden bitir.
        throw new NonRetriableError(`Post not found: ${payload.postId}`);
      }

      const voterRows = await getDb()
        .selectDistinct({ email: users.email })
        .from(votes)
        .innerJoin(users, eq(users.id, votes.userId))
        .where(eq(votes.postId, payload.postId));

      const authorRows = await getDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, post.authorId))
        .limit(1);

      const emails = [
        ...new Set([...authorRows.map((row) => row.email), ...voterRows.map((row) => row.email)]),
      ];

      return { postId: post.id, title: post.title, emails };
    });

    if (recipients.emails.length === 0) {
      return { skipped: true, reason: "no-recipients" };
    }

    // 2) Şablonu hazırla ve toplu gönder. Provider (Resend/Ethereal) env'e göre
    // lib/email/send.ts içinde seçilir.
    const result = await step.run("send-shipped-emails", async () => {
      const message = renderShippedEmail({ title: recipients.title });
      return sendEmails(
        recipients.emails.map((email) => ({
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        })),
      );
    });

    return {
      provider: result.provider,
      recipients: recipients.emails.length,
      sent: result.sent,
      failed: result.failed,
      previewUrls: result.previewUrls,
    };
  },
);
