import { and, eq, inArray, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { analyzeIdea, compareIdeas, normalizeTags } from "@/lib/ai/analysis";
import { embedText } from "@/lib/ai/openrouter";
import { sendEmails } from "@/lib/email/send";
import { renderAdminNewPostEmail } from "@/lib/email/admin-new-post";
import { renderChangelogEmail } from "@/lib/email/changelog";
import { renderCommentEmail } from "@/lib/email/comment";
import { renderStatusUpdateEmail } from "@/lib/email/status-update";
import { renderShippedEmail } from "@/lib/email/shipped";
import { statusLabels } from "@/lib/post-format";
import {
  deliverWebhook,
  loadWebhookEndpoints,
  type WebhookEventName,
} from "@/lib/webhooks/dispatch";
import { hydrateWebhookPayload } from "@/lib/webhooks/payload";
import {
  markDeliveryDelivered,
  recordDeliveryFailure,
} from "@/lib/webhooks/delivery-log";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import {
  aiSuggestions,
  boards,
  changelogEntries,
  changelogPostLinks,
  changelogSubscribers,
  comments,
  emailDeliveries,
  postFollowers,
  postTags,
  posts,
  tags,
  users,
} from "@/lib/db/schema";
import {
  changelogPublishedEventSchema,
  commentCreatedEventSchema,
  postCreatedEventSchema,
  postStatusChangedEventSchema,
  type ChangelogPublishedEvent,
  type CommentCreatedEvent,
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

    // 3) Aday varsa LLM ile çift doğrula. Sprint 33: DUPLICATE kararı artık
    // doğrudan uygulanmaz — pending öneri olarak Autopilot Inbox'a düşer;
    // admin approve edince Sprint 20 merge CTE'si birleştirir.
    let duplicateSuggestion: {
      duplicateOf: string;
      similarity: number;
      note: string;
    } | null = null;

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
        duplicateSuggestion = {
          duplicateOf: candidate.id,
          similarity: candidate.similarity,
          note: `Bu istek "${candidate.title}" ile yüksek olasılıkla tekrar (cosine ${candidate.similarity.toFixed(3)}, LLM onaylı)`,
        };
      }
    }

    // 4) Özet + sentiment + etiketler. Tenant bağlamı: postun board adı
    // analyzeIdea'ya geçirilir (bağımsız workspace'lerde içerik karışmaz).
    const boardContext: string | null | undefined = await step.run(
      "resolve-board-context",
      async () => {
      const [post] = await getDb()
        .select({ boardId: posts.boardId })
        .from(posts)
        .where(eq(posts.id, payload.postId))
        .limit(1);
      if (!post?.boardId) return undefined;
      const [board] = await getDb()
        .select({ name: boards.name })
        .from(boards)
        .where(eq(boards.id, post.boardId))
        .limit(1);
      return board?.name ?? undefined;
    });
    const analysis = await step.run("analyze-idea", async () =>
      analyzeIdea(
        { title: payload.title, description: payload.description },
        { boardName: boardContext ?? undefined },
      ),
    );

    // 5) Tüm sonuçları tek yazımda kaydet. duplicateOf artık buraya yazılmaz
    // (Sprint 33) — onay bekleyen öneri inbox'ta durur.
    await step.run("persist-ai-results", async () => {
      await getDb()
        .update(posts)
        .set({
          aiSummary: analysis.summary,
          sentimentLabel: analysis.sentiment,
          aiKeywords: analysis.keywords,
          postType: analysis.type,
          embeddingVector: embedding,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, payload.postId));
    });

    // 5b) Sprint 33: pending duplicate önerisini inbox'a yaz. Delete+insert
    // idempotent: retry'da önceki pending kayıt silinip yeniden eklenir,
    // sonuç aynı kalır.
    if (duplicateSuggestion) {
      await step.run("save-duplicate-suggestion", async () => {
        await getDb()
          .delete(aiSuggestions)
          .where(
            and(
              eq(aiSuggestions.postId, payload.postId),
              eq(aiSuggestions.type, "duplicate"),
              eq(aiSuggestions.status, "pending"),
            ),
          );
        await getDb().insert(aiSuggestions).values({
          postId: payload.postId,
          type: "duplicate",
          payload: duplicateSuggestion,
          confidence: Math.round(duplicateSuggestion.similarity * 100),
        });
      });
    }

    // 6) Sprint 21: keyword'leri normalize edip tags + post_tags'e yaz.
    //    Upsert idempotent; eski bağlantılar temizlenip yenilenir (retry
    //    sonrası tekrar çalışsa bile sonuç aynı kalır).
    await step.run("sync-tags", async () => {
      const names = normalizeTags(analysis.keywords);
      if (names.length === 0) {
        return { tags: 0 };
      }

      const workspaceId = await getWorkspaceId();

      await getDb()
        .insert(tags)
        .values(names.map((name) => ({ name, workspaceId })))
        .onConflictDoNothing();

      const tagRows = await getDb()
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(
          and(eq(tags.workspaceId, workspaceId), inArray(tags.name, names)),
        );

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

    return {
      duplicateSuggested: Boolean(duplicateSuggestion),
      sentiment: analysis.sentiment,
    };
  },
);

// plan.md Sprint 6 + Sprint 26: durum değişikliği bildirimi. Alıcılar
// artık post_followers tablosundan (yazar + oy veren + yorum yazanlar
// otomatik takipçi). shipped geçişi kutlama maili; diğer geçişler bilgilendirme
// maili alır. Tercihler (users.email_status_updates) ve email_deliveries
// idempotency uygulanır; her alıcı için kişisel unsubscribe linki render edilir.
export const notifyShipped = inngest.createFunction(
  { id: "notify-shipped", retries: 3, triggers: { event: "post/status.changed" } },
  async ({ event, step }) => {
    const payload: PostStatusChangedEvent = postStatusChangedEventSchema.parse(
      event.data,
    );

    const isShipped = payload.newStatus === "shipped";
    const deliveryType = isShipped ? "shipped" : "status";

    // 1) Alıcılar: takipçiler + tercih + idempotency filtresi (tek step).
    const recipients = await step.run("fetch-recipients", async () => {
      const [post] = await getDb()
        .select({ id: posts.id, title: posts.title })
        .from(posts)
        .where(
          and(
            eq(posts.workspaceId, await getWorkspaceId()),
            eq(posts.id, payload.postId),
          ),
        )
        .limit(1);

      if (!post) {
        // Post silinmişse retry anlamsız — tekrar denemeden bitir.
        throw new NonRetriableError(`Post not found: ${payload.postId}`);
      }

      const followerRows = await getDb()
        .selectDistinct({
          userId: users.id,
          email: users.email,
          token: users.unsubscribeToken,
          emailStatusUpdates: users.emailStatusUpdates,
        })
        .from(postFollowers)
        .innerJoin(users, eq(users.id, postFollowers.userId))
        .where(eq(postFollowers.postId, payload.postId));

      // Idempotency: bu (kullanıcı, tip, fikir) için daha önce mail
      // gönderildiyse tekrar gönderme (event replay / tekrar shipped).
      const delivered = await getDb()
        .select({ userId: emailDeliveries.userId })
        .from(emailDeliveries)
        .where(
          and(
            eq(emailDeliveries.type, deliveryType),
            eq(emailDeliveries.entityId, payload.postId),
          ),
        );
      const deliveredIds = new Set(delivered.map((row) => row.userId));

      return {
        postId: post.id,
        title: post.title,
        recipients: followerRows
          .filter((row) => !deliveredIds.has(row.userId))
          // Sprint 26: kullanıcı tercihine saygı — status bildirimleri
          // kapalıysa (shipped dahil) mail yok.
          .filter((row) => row.emailStatusUpdates)
          .map((row) => ({
            userId: row.userId,
            email: row.email,
            token: row.token,
          })),
      };
    });

    if (recipients.recipients.length === 0) {
      return { skipped: true, reason: "no-recipients" };
    }

    // 2) Her alıcı için kişisel unsubscribe linkiyle render et ve gönder.
    // Provider (Resend/Ethereal) env'e göre lib/email/send.ts'te seçilir.
    const result = await step.run("send-status-emails", async () => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
      const messages = recipients.recipients.map((recipient) => {
        const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${recipient.token}&type=status`;
        const message = isShipped
          ? renderShippedEmail({
              title: recipients.title,
              note: payload.note,
              unsubscribeUrl,
            })
          : renderStatusUpdateEmail({
              ideaTitle: recipients.title,
              ideaUrl: `${appUrl}/portal/${recipients.postId}`,
              oldStatusLabel:
                statusLabels[payload.oldStatus] ?? payload.oldStatus,
              newStatusLabel:
                statusLabels[payload.newStatus] ?? payload.newStatus,
              note: payload.note,
              unsubscribeUrl,
            });
        return {
          to: recipient.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        };
      });
      return sendEmails(messages);
    });

    // 3) Gönderim kaydı (idempotency) — best-effort, hata akışı bozmaz.
    await step.run("record-deliveries", async () => {
      await getDb()
        .insert(emailDeliveries)
        .values(
          recipients.recipients.map((recipient) => ({
            userId: recipient.userId,
            type: deliveryType,
            entityId: payload.postId,
          })),
        )
        .onConflictDoNothing();
    });

    return {
      provider: result.provider,
      recipients: recipients.recipients.length,
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

// plan.md Sprint 24 + 26: fikre yeni (iç olmayan) yorum geldiğinde
// takipçilere bildirim (yazar + oy veren + yorum yazanlar otomatik takipçi).
// Yorumcuya mail gitmez; email_comments tercihi kapalı olanlara da gitmez.
// email_deliveries ile mükerrer gönderim engellenir.
export const notifyCommentCreated = inngest.createFunction(
  { id: "notify-comment-created", retries: 3, triggers: { event: "post/comment.created" } },
  async ({ event, step }) => {
    const payload: CommentCreatedEvent = commentCreatedEventSchema.parse(
      event.data,
    );

    const context = await step.run("fetch-comment-recipients", async () => {
      const [comment] = await getDb()
        .select({
          id: comments.id,
          postId: comments.postId,
          userId: comments.userId,
          body: comments.body,
          parentId: comments.parentId,
        })
        .from(comments)
        .where(eq(comments.id, payload.commentId))
        .limit(1);
      if (!comment) {
        throw new NonRetriableError(
          `Comment not found: ${payload.commentId}`,
        );
      }

      const [post] = await getDb()
        .select({ id: posts.id, title: posts.title })
        .from(posts)
        .where(
          and(
            eq(posts.workspaceId, await getWorkspaceId()),
            eq(posts.id, comment.postId),
          ),
        )
        .limit(1);
      if (!post) {
        throw new NonRetriableError(`Post not found: ${comment.postId}`);
      }

      const [commenter] = await getDb()
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, comment.userId))
        .limit(1);

      const followerRows = await getDb()
        .selectDistinct({
          userId: users.id,
          email: users.email,
          token: users.unsubscribeToken,
          emailComments: users.emailComments,
        })
        .from(postFollowers)
        .innerJoin(users, eq(users.id, postFollowers.userId))
        .where(eq(postFollowers.postId, comment.postId));

      // Idempotency: aynı yorum için daha önce gönderilmişse tekrar yok.
      const delivered = await getDb()
        .select({ userId: emailDeliveries.userId })
        .from(emailDeliveries)
        .where(
          and(
            eq(emailDeliveries.type, "comment"),
            eq(emailDeliveries.entityId, comment.id),
          ),
        );
      const deliveredIds = new Set(delivered.map((row) => row.userId));

      const recipients = followerRows
        .filter((row) => row.userId !== comment.userId)
        .filter((row) => !deliveredIds.has(row.userId))
        .filter((row) => row.emailComments)
        .map((row) => ({
          userId: row.userId,
          email: row.email,
          token: row.token,
        }));

      // Yanıt metni: parent yorumu varsa "yanıt" olarak gösterilir.
      const isReply = Boolean(comment.parentId);

      return {
        recipients,
        ideaTitle: post.title,
        ideaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app"}/portal/${post.id}`,
        commenterName: commenter?.name ?? null,
        commentBody: comment.body,
        isReply,
      };
    });

    if (context.recipients.length === 0) {
      return { skipped: true, reason: "no-recipients" };
    }

    const result = await step.run("send-comment-emails", async () => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
      const messages = context.recipients.map((recipient) => {
        const message = renderCommentEmail({
          ideaTitle: context.ideaTitle,
          ideaUrl: context.ideaUrl,
          commenterName: context.commenterName,
          commentBody: context.commentBody,
          isReply: context.isReply,
          unsubscribeUrl: `${appUrl}/api/unsubscribe?token=${recipient.token}&type=comment`,
        });
        return {
          to: recipient.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        };
      });
      return sendEmails(messages);
    });

    // Gönderim kaydı (idempotency) — best-effort.
    await step.run("record-deliveries", async () => {
      await getDb()
        .insert(emailDeliveries)
        .values(
          context.recipients.map((recipient) => ({
            userId: recipient.userId,
            type: "comment",
            entityId: payload.commentId,
          })),
        )
        .onConflictDoNothing();
    });

    return {
      provider: result.provider,
      recipients: context.recipients.length,
      sent: result.sent,
      failed: result.failed,
      previewUrls: result.previewUrls,
    };
  },
);

// Sprint 34 — webhook teslimatı: kaynak Inngest olaylarını noktalı webhook
// olay adlarına çevirip abone endpoint'lere imzalı POST atar (analiz raporu
// P4.2). Her endpoint ayrı step: tek hata yalnızca kendi teslimatını retry
// eder. Sprint 43: matrix tamamlandı — oy/yorum silme + duyuru olayları da
// eklenir ve payload teslimat öncesi zenginleştirilir (lib/webhooks/payload).
const WEBHOOK_EVENT_MAP: Record<string, WebhookEventName> = {
  "post/created": "post.created",
  "post/status.changed": "post.status_changed",
  "post/comment.created": "comment.created",
  "post/comment.deleted": "comment.deleted",
  "vote/created": "vote.created",
  "vote/deleted": "vote.deleted",
  "changelog/published": "changelog.published",
};

export const sendWebhooks = inngest.createFunction(
  {
    id: "send-webhooks",
    retries: 3,
    triggers: [
      { event: "post/created" },
      { event: "post/status.changed" },
      { event: "post/comment.created" },
      { event: "post/comment.deleted" },
      { event: "vote/created" },
      { event: "vote/deleted" },
      { event: "changelog/published" },
    ],
  },
  async ({ event, step }) => {
    const webhookEvent = WEBHOOK_EVENT_MAP[event.name];
    if (!webhookEvent) {
      throw new NonRetriableError(`Bilinmeyen webhook olayı: ${event.name}`);
    }

    const endpoints = await step.run("load-endpoints", () =>
      loadWebhookEndpoints(webhookEvent),
    );
    if (endpoints.length === 0) {
      return { event: webhookEvent, delivered: 0 };
    }

    // Tüketicinin kullanabileceği bağlamı tek kez çöz; teslimat her endpoint
    // için aynı zengin payload'ı kullanır.
    const hydrated = await step.run("hydrate-payload", () =>
      hydrateWebhookPayload(webhookEvent, event.data),
    );

    let delivered = 0;
    for (const endpoint of endpoints) {
      await step.run(`deliver-${endpoint.id}`, async () => {
        const upsert = {
          workspaceId: await getWorkspaceId(),
          endpointId: endpoint.id,
          event: webhookEvent,
          payload: hydrated,
        };
        try {
          await deliverWebhook(endpoint, webhookEvent, hydrated);
          await markDeliveryDelivered(upsert);
        } catch (deliveryErr) {
          // Dead-letter kaydı + Inngest'in retry etmesi için rethrow.
          await recordDeliveryFailure(
            upsert,
            deliveryErr instanceof Error
              ? deliveryErr.message
              : "Bilinmeyen teslimat hatası",
          );
          throw deliveryErr;
        }
      });
      delivered += 1;
    }

    return { event: webhookEvent, delivered };
  },
);

// Sprint 40: changelog abonelerine yeni duyuru maili (changelog/published).
// Alıcılar changelog_subscribers'tan çözülür — anonim aboneler users
// tablosunda olmadığı için email_deliveries idempotency KULLANILAMAZ;
// tekrar gönderimi Inngest step memoization önler (adım bir kez
// tamamlanınca retry/replay aynı adımı tekrar çalıştırmaz).
export const notifyChangelog = inngest.createFunction(
  {
    id: "notify-changelog",
    retries: 3,
    triggers: { event: "changelog/published" },
  },
  async ({ event, step }) => {
    const payload: ChangelogPublishedEvent =
      changelogPublishedEventSchema.parse(event.data);

    // 1) Duyuru doğrulaması + alıcılar (tek step).
    const recipients = await step.run("fetch-recipients", async () => {
      const [entry] = await getDb()
        .select({ workspaceId: changelogEntries.workspaceId })
        .from(changelogEntries)
        .where(eq(changelogEntries.id, payload.entryId))
        .limit(1);

      if (!entry) {
        // Duyuru silinmişse retry anlamsız.
        throw new NonRetriableError(
          `Changelog entry not found: ${payload.entryId}`,
        );
      }

      return getDb()
        .select({
          email: changelogSubscribers.email,
          token: changelogSubscribers.unsubscribeToken,
        })
        .from(changelogSubscribers)
        .where(eq(changelogSubscribers.workspaceId, entry.workspaceId));
    });

    if (recipients.length === 0) {
      return { skipped: true, reason: "no-recipients" };
    }

    // 2) Her abone için kişisel unsubscribe linkiyle render et ve gönder.
    // Provider (Resend/Ethereal) env'e göre lib/email/send.ts'te seçilir.
    const result = await step.run("send-changelog-emails", async () => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
      const entryUrl = `${appUrl}/portal/changelog/${payload.entryId}`;
      const messages = recipients.map((recipient) => {
        const message = renderChangelogEmail({
          title: payload.title,
          body: payload.body,
          entryUrl,
          unsubscribeUrl: `${appUrl}/api/unsubscribe?token=${recipient.token}&type=changelog`,
        });
        return {
          to: recipient.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        };
      });
      return sendEmails(messages);
    });

    return {
      provider: result.provider,
      recipients: recipients.length,
      sent: result.sent,
      failed: result.failed,
      previewUrls: result.previewUrls,
    };
  },
);
