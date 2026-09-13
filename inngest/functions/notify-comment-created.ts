// Sprint 70.1 — tek sorumluluk: notifyCommentCreated.
import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { sendEmails } from "@/lib/email/send";
import { renderCommentEmail } from "@/lib/email/comment";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { comments, emailDeliveries, postFollowers, posts, users } from "@/lib/db/schema";
import { commentCreatedEventSchema, type CommentCreatedEvent } from "@/lib/validations/events";
import { inngest } from "../client";

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

      // 2026-09-12 (denetim K4): yazarı silinmiş bir yorumun user_id'si NULL
      // olabilir (içerik korunur, yazar bağlantısı düşer) → sorgu atlanır.
      const [commenter] = comment.userId
        ? await getDb()
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, comment.userId))
            .limit(1)
        : [];

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
