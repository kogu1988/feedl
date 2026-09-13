// Sprint 70.1 — tek sorumluluk: notifyShipped.
import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { sendEmails } from "@/lib/email/send";
import { renderStatusUpdateEmail } from "@/lib/email/status-update";
import { renderShippedEmail } from "@/lib/email/shipped";
import { statusLabels } from "@/lib/post-format";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { emailDeliveries, postFollowers, posts, users } from "@/lib/db/schema";
import { postStatusChangedEventSchema, type PostStatusChangedEvent } from "@/lib/validations/events";
import { inngest } from "../client";

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
