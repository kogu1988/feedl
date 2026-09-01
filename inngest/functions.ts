import { eq, inArray, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { analyzeIdea, compareIdeas, normalizeTags } from "@/lib/ai/analysis";
import { embedText } from "@/lib/ai/openrouter";
import { sendEmails } from "@/lib/email/send";
import { renderAdminNewPostEmail } from "@/lib/email/admin-new-post";
import { renderShippedEmail } from "@/lib/email/shipped";
import { getDb } from "@/lib/db";
import { postTags, posts, tags, users, votes } from "@/lib/db/schema";
import {
  postCreatedEventSchema,
  postStatusChangedEventSchema,
  type PostCreatedEvent,
  type PostStatusChangedEvent,
} from "@/lib/validations/events";
import { inngest } from "./client";

// plan.md Sprint 5: cosine adayları LLM ile çift doğrulanır (prompts.md §2);
// LLM "DUPLICATE" derse yeni post duplicate işaretlenir. Eşik kalibrasyonu
// canlı veriyle revize edildi (2026-09-01): gerçek yakın-kopya çift 0.547,
// alakasız-generic çiftler 0.489'a kadar çıkabiliyor → 0.60 kaçırdı, 0.45
// iki bandı ayırır. Post başına en fazla 1 LLM karşılaştırması olduğu için
// düşük eşiğin maliyeti sınırlı; yanlış adayları LLM eler.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.45;
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
          postType: analysis.type,
          embeddingVector: embedding,
          ...(duplicateOf ? { duplicateOf, duplicateNote } : {}),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, payload.postId));
    });

    // 6) Sprint 21: keyword'leri normalize edip tags + post_tags'e yaz.
    //    Upsert idempotent; eski bağlantılar temizlenip yenilenir (retry
    //    sonrası tekrar çalışsa bile sonuç aynı kalır).
    await step.run("sync-tags", async () => {
      const names = normalizeTags(analysis.keywords);
      if (names.length === 0) {
        return { tags: 0 };
      }

      await getDb()
        .insert(tags)
        .values(names.map((name) => ({ name })))
        .onConflictDoNothing();

      const tagRows = await getDb()
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, names));

      await getDb()
        .delete(postTags)
        .where(eq(postTags.postId, payload.postId));

      await getDb()
        .insert(postTags)
        .values(
          tagRows.map((tag) => ({ postId: payload.postId, tagId: tag.id })),
        )
        .onConflictDoNothing();

      return { tags: tagRows.length };
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

// plan.md Sprint 18: yeni fikir düştüğünde admin'e kısa bildirim. post/created
// event'ini ai-autopilot da tüketiyor; Inngest birden çok fonksiyonun aynı
// event'e bağlanmasına izin verir. Admin kendi fikri için mail almaz.
export const notifyAdminNewPost = inngest.createFunction(
  { id: "notify-admin-post-created", retries: 3, triggers: { event: "post/created" } },
  async ({ event, step }) => {
    const payload: PostCreatedEvent = postCreatedEventSchema.parse(event.data);

    // 1) Alıcılar (DB tek kaynak: users.role=admin) + yazar bilgisi.
    //    Yazarın kendi e-postası admin listesinden çıkarılır.
    const context = await step.run("fetch-admins-and-author", async () => {
      const adminRows = await getDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.role, "admin"));

      const [author] = await getDb()
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      return {
        adminEmails: adminRows
          .map((row) => row.email)
          .filter((email) => email !== author?.email),
        authorName: author?.name ?? author?.email ?? "Bir üye",
      };
    });

    if (context.adminEmails.length === 0) {
      return { skipped: true, reason: "no-admin-recipients" };
    }

    // 2) Şablonu hazırla ve gönder. Provider seçimi lib/email/send.ts'te.
    const result = await step.run("send-admin-email", async () => {
      const message = renderAdminNewPostEmail({
        title: payload.title,
        description: payload.description,
        authorName: context.authorName,
        postId: payload.postId,
      });
      return sendEmails(
        context.adminEmails.map((email) => ({
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        })),
      );
    });

    return {
      provider: result.provider,
      recipients: context.adminEmails.length,
      sent: result.sent,
      failed: result.failed,
      previewUrls: result.previewUrls,
    };
  },
);
