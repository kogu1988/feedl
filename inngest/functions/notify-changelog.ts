// Sprint 70.1 — tek sorumluluk: notifyChangelog.
import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { sendEmails } from "@/lib/email/send";
import { renderChangelogEmail } from "@/lib/email/changelog";
import { getDb } from "@/lib/db";
import { changelogEntries, changelogSubscribers, emailDeliveries } from "@/lib/db/schema";
import { changelogPublishedEventSchema, type ChangelogPublishedEvent } from "@/lib/validations/events";
import { inngest } from "../client";

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
