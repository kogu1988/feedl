import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { planFromString } from "@/lib/paddle";

import { analyzeIdea, compareIdeas, normalizeTags } from "@/lib/ai/analysis";
import { buildLearnedContext } from "@/lib/ai/prompts";
import { analyzeCorpus } from "@/lib/ai/insights";
import { embedText } from "@/lib/ai/openrouter";
import { sendEmails } from "@/lib/email/send";
import { renderAdminNewPostEmail } from "@/lib/email/admin-new-post";
import { renderChangelogEmail } from "@/lib/email/changelog";
import { renderCommentEmail } from "@/lib/email/comment";
import { renderStatusUpdateEmail } from "@/lib/email/status-update";
import { renderShippedEmail } from "@/lib/email/shipped";
import { renderDigestEmail, shouldSendDigest } from "@/lib/email/digest";
import { statusLabels } from "@/lib/post-format";
import {
  deliverToAllEndpoints,
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
import { listWorkspaceTeam } from "@/lib/db/membership";
import {
  aiSuggestions,
  aiTriageSignals,
  boards,
  changelogEntries,
  changelogSubscribers,
  comments,
  emailDeliveries,
  postFollowers,
  postTags,
  posts,
  tags,
  users,
  votes,
  workspaces,
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
const MAX_CORPUS = 60;
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
                 1 - (embedding_vector <=> ${vectorLiteral}::halfvec) AS similarity
          FROM posts
          WHERE embedding_vector IS NOT NULL AND id <> ${payload.postId}
          ORDER BY embedding_vector <=> ${vectorLiteral}::halfvec
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
    // Faz 1: teknik bağlam (cihaz/viewport/tarayıcı/OS) da eklenir — AI'ya
    // "kanıt" verir (ör. "mobilde" bug'ı).
    const aiContext = await step.run("resolve-ai-context", async () => {
      const [post] = await getDb()
        .select({
          boardId: posts.boardId,
          workspaceId: posts.workspaceId,
          deviceType: posts.deviceType,
          viewportWidth: posts.viewportWidth,
          viewportHeight: posts.viewportHeight,
          browser: posts.browser,
          os: posts.os,
        })
        .from(posts)
        .where(eq(posts.id, payload.postId))
        .limit(1);
      if (!post) {
        return { boardName: undefined, technical: undefined, learned: undefined };
      }
      let boardName: string | undefined;
      if (post.boardId) {
        const [board] = await getDb()
          .select({ name: boards.name })
          .from(boards)
          .where(eq(boards.id, post.boardId))
          .limit(1);
        boardName = board?.name ?? undefined;
      }
      const parts: string[] = [];
      if (post.deviceType) parts.push(`cihaz: ${post.deviceType}`);
      if (post.viewportWidth && post.viewportHeight) {
        parts.push(`viewport: ${post.viewportWidth}×${post.viewportHeight}`);
      }
      if (post.browser) parts.push(`tarayıcı: ${post.browser}`);
      if (post.os) parts.push(`OS: ${post.os}`);

      // Faz 3: workspace'in son triage sinyalleri (ilgisiz / tür düzeltmesi) →
      // prompt bağlamı. En yeni 8 sinyal, post başlığıyla birlikte.
      const signalRows = await getDb()
        .select({
          kind: aiTriageSignals.kind,
          aiValue: aiTriageSignals.aiValue,
          correctValue: aiTriageSignals.correctValue,
          title: posts.title,
        })
        .from(aiTriageSignals)
        .innerJoin(posts, eq(posts.id, aiTriageSignals.postId))
        .where(eq(aiTriageSignals.workspaceId, post.workspaceId))
        .orderBy(desc(aiTriageSignals.createdAt))
        .limit(8);
      const learned = buildLearnedContext(
        signalRows.map((s) => ({
          kind: s.kind === "type_corrected" ? "type_corrected" : "not_relevant",
          title: s.title,
          aiValue: s.aiValue,
          correctValue: s.correctValue,
        })),
      );
      return {
        boardName,
        technical: parts.length > 0 ? parts.join(" · ") : undefined,
        learned: learned || undefined,
      };
    });
    const analysis = await step.run("analyze-idea", async () =>
      analyzeIdea(
        { title: payload.title, description: payload.description },
        {
          boardName: aiContext.boardName,
          technical: aiContext.technical,
          learned: aiContext.learned,
        },
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
          // Sprint 63v: List-Unsubscribe — Gmail/Outlook spam filtresi için.
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });
      return sendEmails(messages);
    });

    // 3) Gönderim kaydı (idempotency) — best-effort, hata akışı bozmaz.
    // Sprint 63v: providerId (Resend message id) + status 'sent' kaydedilir;
    // deliverability webhook'u provider_id ile eşleşip durumu günceller.
    await step.run("record-deliveries", async () => {
      const ids = result.ids ?? [];
      await getDb()
        .insert(emailDeliveries)
        .values(
          recipients.recipients.map((recipient, i) => ({
            userId: recipient.userId,
            type: deliveryType,
            entityId: payload.postId,
            providerId: ids[i] ?? null,
            status: "sent",
          })),
        )
        .onConflictDoNothing();
    });

    return {
      provider: result.provider,
      recipients: recipients.recipients.length,
      sent: result.sent,
      failed: result.failed,
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

    // 1) Alıcılar = workspace EKİBİ (owner/admin/contributor) + yazar bilgisi.
    //    Platform personeli (`users.role='admin'`) bilinçli olarak dahil DEĞİL —
    //    o işaret feedl iç paneli için ayrılmıştır ve müşteri bildirimi almaz.
    //    Yazarın kendi e-postası listeden çıkarılır.
    const context = await step.run("fetch-team-and-author", async () => {
      const [post] = await getDb()
        .select({ workspaceId: posts.workspaceId })
        .from(posts)
        .where(eq(posts.id, payload.postId))
        .limit(1);

      const team = post?.workspaceId
        ? await listWorkspaceTeam(post.workspaceId)
        : [];

      const [author] = await getDb()
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      return {
        adminEmails: [...new Set(team.map((row) => row.email))].filter(
          (email) => email !== author?.email,
        ),
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
          // Sprint 63v: List-Unsubscribe (deliverability).
          headers: {
            "List-Unsubscribe": `<${appUrl}/api/unsubscribe?token=${recipient.token}&type=comment>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });
      return sendEmails(messages);
    });

    // Gönderim kaydı (idempotency) — best-effort. Sprint 63v: providerId + status.
    await step.run("record-deliveries", async () => {
      const ids = result.ids ?? [];
      await getDb()
        .insert(emailDeliveries)
        .values(
          context.recipients.map((recipient, i) => ({
            userId: recipient.userId,
            type: "comment",
            entityId: payload.commentId,
            providerId: ids[i] ?? null,
            status: "sent",
          })),
        )
        .onConflictDoNothing();
    });

    return {
      provider: result.provider,
      recipients: context.recipients.length,
      sent: result.sent,
      failed: result.failed,
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

    // Her endpoint'e BAĞIMSIZ teslimat: bir endpoint'in hatası diğerlerini aç
    // bırakmasın. Hatalar toplanır ve sonunda fırlatılır → Inngest retry eder
    // + dead-letter kaydı düşer; başarılı endpoint'ler step memoization
    // sayesinde TEKRAR teslim edilmez.
    const { delivered, failed } = await deliverToAllEndpoints(
      endpoints,
      (endpoint) =>
        step.run(`deliver-${endpoint.id}`, async () => {
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
        }),
    );
    if (failed.length > 0) {
      throw new Error(
        `${failed.length}/${endpoints.length} webhook endpoint teslimatı başarısız: ${failed.join(", ")}`,
      );
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

    // Sprint 63x (B10) — changelog abone mail'lerini deliverability'ye bağla.
    // Anonim aboneler users'ta yok → userId null, email dolu. İdempotency:
    // (email, type, entityId) önce var mı kontrol et (çifte kayıt önlenir).
    await step.run("record-changelog-deliveries", async () => {
      const existing = await getDb()
        .select({ email: emailDeliveries.email })
        .from(emailDeliveries)
        .where(
          and(
            eq(emailDeliveries.type, "changelog"),
            eq(emailDeliveries.entityId, payload.entryId),
          ),
        )
        .limit(1);
      if (existing.length > 0) return;

      const ids = result.ids ?? [];
      await getDb()
        .insert(emailDeliveries)
        .values(
          recipients.map((recipient, i) => ({
            userId: null,
            email: recipient.email,
            type: "changelog",
            entityId: payload.entryId,
            providerId: ids[i] ?? null,
            status: "sent",
          })),
        )
        .onConflictDoNothing();
    });

    return {
      provider: result.provider,
      recipients: recipients.length,
      sent: result.sent,
      failed: result.failed,
    };
  },
);

// Sprint 63l — corpus AI içgörüleri ARKA PLANDA. Sayfa (dashboard/insights)
// LLM çağrısını ENGellemez; bu fonksiyon `corpus-insights.request` event'i ile
// tetiklenir, en çok oy alan N fikri korpus olarak LLM'e verir ve sonucu
// workspace.corpus_insights alanına yazar (cache). Sayfa bu cache'i okur —
// yavaş/geciken ücretsiz LLM yüzünden 500/blank olmaz.
export const corpusInsights = inngest.createFunction(
  {
    id: "corpus-insights",
    retries: 2,
    triggers: { event: "corpus-insights.request" },
    // Workspace BASINA 1 eşzamanlı analiz (anahtarlı). Eskiden global
    // FUNCTION limitiydi (`concurrency: 1`): tek bir workspace'in yavaş
    // analizi diğer TÜM workspace'leri bekletiyordu (çok kiracılı
    // adaletsizlik) ve 2026-09-11'de bu tek global slot takılıp fonksiyon
    // saatlerce QUEUED kaldı (diğer fonksiyonlar normal çalışırken).
    // Anahtarlı limit her workspace'e kendi slotunu verir.
    concurrency: { limit: 1, key: "event.data.workspaceId" },
  },
  async ({ event, step }) => {
    const workspaceId = (event.data as { workspaceId: string }).workspaceId;
    const db = getDb();

    // İşlem başladı: status='pending'.
    await step.run("mark-pending", async () => {
      await db
        .update(workspaces)
        .set({ corpusInsightsStatus: "pending", updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    });

    try {
      // Sprint 63n — defense-in-depth: workspace artık pro değilse (downgrade
      // veya sırada bekleyen eski event) LLM çağrısı ÜRETME. Kuyrukta kalan bir
      // event bile maliyet doğurmaz; cache'e "pro gerekir" notu yazılır.
      const planKey = await step.run("check-plan", async () => {
        const [row] = await db
          .select({ plan: workspaces.plan })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1);
        return planFromString(row?.plan);
      });
      if (planKey !== "pro") {
        await step.run("store-pro-required", async () => {
          // Cache'e PLAN METNİ YAZILMAZ. Eskiden buraya "AI içgörüleri Pro plan
          // özelliğidir…" cümlesi recommendation olarak yazılıyordu; plan
          // Pro'ya geçince bu bayat metin gerçek içgörü sanılıp gösteriliyordu
          // (sayfada hem Pro uyarısı hem "Yenile" butonu görünüyordu).
          // Doğrusu: cache'i BOŞ bırak — sayfa kilit durumunu CANLI plandan
          // türetir, cache yalnız gerçek analiz sonucu taşır.
          await db
            .update(workspaces)
            .set({
              corpusInsights: null,
              corpusInsightsStatus: "idle",
              corpusInsightsAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspaceId));
        });
        return { status: "done", corpusSize: 0, planned: "free" };
      }

      // En çok oy alan fikirleri topla (aynı MAX_CORPUS sınırı).
      const rows = await step.run("load-corpus", async () => {
        return db
          .select({
            id: posts.id,
            title: posts.title,
            description: posts.description,
            status: posts.status,
            voteCount: count(votes.id),
          })
          .from(posts)
          .leftJoin(votes, eq(votes.postId, posts.id))
          .where(eq(posts.workspaceId, workspaceId))
          .groupBy(posts.id)
          .orderBy(desc(count(votes.id)), asc(posts.id))
          .limit(MAX_CORPUS);
      });

      if (rows.length === 0) {
        await step.run("store-empty", async () => {
          await db
            .update(workspaces)
            .set({
              corpusInsightsStatus: "done",
              corpusInsightsAt: new Date(),
              corpusInsights: {
                themes: [],
                trends: [],
                quickWins: [],
                risks: [],
                recommendation:
                  "Henüz yeterli geri bildirim yok. İlk fikirler geldikçe içgörü üretilir.",
              },
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspaceId));
        });
        return { status: "done", corpusSize: 0 };
      }

      // LLM analizi (arka planda devam eder; timeout yok). Şekil bozukluğu
      // analyzeCorpus içinde graceful fallback'e düşer; yalnız AĞ hatası fırlatır
      // → Inngest retry (2x) sonrası hala başarısızsa alttaki catch status='error' yapar.
      const insights = await step.run("analyze-corpus", async () =>
        analyzeCorpus(
          rows.map((r) => ({
            title: r.title,
            description: r.description,
            status: r.status,
            votes: Number(r.voteCount),
          })),
        ),
      );

      await step.run("store-result", async () => {
        await db
          .update(workspaces)
          .set({
            corpusInsightsStatus: "done",
            corpusInsightsAt: new Date(),
            corpusInsights: insights,
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
      });

      return { status: "done", corpusSize: rows.length };
    } catch (err) {
      // Kalıcı hata: status='error' — böylece route pending'de takılmaz ve
      // kullanıcı tekrar "Yenile" ile retry edebilir. Rethrow: Inngest yine de
      // hata kaydı tutar ve retry (yukarıda 2x) politikanı uygular.
      console.error(
        "corpus-insights failed:",
        err instanceof Error ? err.message : err,
      );
      await step.run("mark-error", async () => {
        await db
          .update(workspaces)
          .set({
            corpusInsightsStatus: "error",
            corpusInsightsAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
      });
      throw err;
    }
  },
);

// Faz 4 — haftalık AI özeti (digest).
// Alınan kararlar (2026-09-10):
//  · Sıklık: haftalık cron (Pazartesi 06:00 UTC = 09:00 TRT) + "yeni geri
//    bildirim yoksa gönderme" eşiği (boş özet gürültüdür).
//  · Teslimat: hem dashboard içgörü önbelleği tazelenir hem admin'lere e-posta.
//  · Kime: workspace ekibi (owner/admin/contributor) ve email_digest tercihi
//    açık olanlar — platform personeli (`users.role='admin'`) dahil değil.
// LLM maliyeti workspace başına haftada 1 korpus çağrısıdır; free plan hiç
// çağrı üretmez (erken çıkış).
export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    retries: 2,
    concurrency: 1,
    triggers: { cron: "0 6 * * 1" },
  },
  async ({ step }) => {
    const candidates = await step.run("load-pro-workspaces", async () =>
      getDb()
        .select({
          id: workspaces.id,
          name: workspaces.name,
          plan: workspaces.plan,
          lastSentAt: workspaces.digestLastSentAt,
        })
        .from(workspaces)
        .where(eq(workspaces.plan, "pro")),
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
    const summary: { workspaceId: string; status: string }[] = [];

    for (const ws of candidates) {
      const outcome = await step.run(`digest-${ws.id}`, async () => {
        const db = getDb();
        const now = new Date();
        // `step.run` dönüşü JSON'a çevrilir (Inngest dayanıklılığı) → timestamp
        // alanı string olarak gelir; karşılaştırma için Date'e çevir.
        const since = ws.lastSentAt ? new Date(ws.lastSentAt) : null;

        const [{ totalPosts }] = await db
          .select({ totalPosts: count(posts.id) })
          .from(posts)
          .where(eq(posts.workspaceId, ws.id));
        const [{ newPosts }] = await db
          .select({ newPosts: count(posts.id) })
          .from(posts)
          .where(
            since
              ? and(eq(posts.workspaceId, ws.id), gte(posts.createdAt, since))
              : eq(posts.workspaceId, ws.id),
          );

        // Alıcılar: workspace EKİBİ (owner/admin/contributor) ve digest
        // tercihi açık olanlar. Platform personeli dahil değil. Aynı kişi iki
        // Clerk kimliğiyle üye olabildiği için e-postaya göre tekilleştirilir
        // (aksi halde tek adrese iki özet giderdi).
        const team = (await listWorkspaceTeam(ws.id)).filter(
          (member) => member.emailDigest,
        );
        const recipients = [
          ...new Map(team.map((member) => [member.email, member])).values(),
        ];

        const plan = planFromString(ws.plan);
        const newPostCount = Number(newPosts);
        if (
          !shouldSendDigest({
            plan,
            enabled: recipients.length > 0,
            lastSentAt: since,
            newPostCount,
            now,
          })
        ) {
          return {
            status: "skipped",
            reason:
              plan !== "pro"
                ? "not-pro"
                : recipients.length === 0
                  ? "no-recipients"
                  : newPostCount === 0
                    ? "no-new-feedback"
                    : "too-soon",
          };
        }

        const rows = await db
          .select({
            id: posts.id,
            title: posts.title,
            description: posts.description,
            status: posts.status,
            voteCount: count(votes.id),
          })
          .from(posts)
          .leftJoin(votes, eq(votes.postId, posts.id))
          .where(eq(posts.workspaceId, ws.id))
          .groupBy(posts.id)
          .orderBy(desc(count(votes.id)), asc(posts.id))
          .limit(MAX_CORPUS);

        const insights = await analyzeCorpus(
          rows.map((r) => ({
            title: r.title,
            description: r.description,
            status: r.status,
            votes: Number(r.voteCount),
          })),
        );

        // Önce gönder, SONRA işaretle: gönderim başarısız olursa hafta
        // kaybedilmesin (aynı adım retry edilir, e-posta gönderilmemiş kalır).
        const result = await sendEmails(
          recipients.map((recipient) => {
            const message = renderDigestEmail({
              workspaceName: ws.name,
              insights,
              inboxUrl: `${appUrl}/dashboard/insights`,
              newPostCount,
              totalPostCount: Number(totalPosts),
              unsubscribeUrl: `${appUrl}/api/unsubscribe?token=${recipient.unsubscribeToken}&type=digest`,
            });
            return {
              to: recipient.email,
              subject: message.subject,
              html: message.html,
              text: message.text,
            };
          }),
        );

        await db
          .update(workspaces)
          .set({
            corpusInsights: insights,
            corpusInsightsAt: now,
            corpusInsightsStatus: "done",
            digestLastSentAt: now,
            updatedAt: now,
          })
          .where(eq(workspaces.id, ws.id));

        return {
          status: "sent",
          recipients: recipients.length,
          sent: result.sent,
          failed: result.failed,
        };
      });

      summary.push({ workspaceId: ws.id, status: outcome.status });
    }

    return {
      workspaces: candidates.length,
      sent: summary.filter((s) => s.status === "sent").length,
      summary,
    };
  },
);
