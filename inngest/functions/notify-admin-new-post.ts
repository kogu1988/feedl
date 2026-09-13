// Sprint 70.1 — tek sorumluluk: notifyAdminNewPost.
import { eq } from "drizzle-orm";
import { sendEmails } from "@/lib/email/send";
import { renderAdminNewPostEmail } from "@/lib/email/admin-new-post";
import { getDb } from "@/lib/db";
import { listWorkspaceTeam } from "@/lib/db/membership";
import { posts, users } from "@/lib/db/schema";
import { postCreatedEventSchema, type PostCreatedEvent } from "@/lib/validations/events";
import { inngest } from "../client";

export const notifyAdminNewPost = inngest.createFunction(
  { id: "notify-admin-post-created", retries: 3, triggers: { event: "post/created" } },
  async ({ event, step }) => {
    const payload: PostCreatedEvent = postCreatedEventSchema.parse(event.data);

    // 1) Alıcılar = workspace EKİBİ (owner/manager/member) + yazar bilgisi.
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
