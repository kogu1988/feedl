// Sprint 70.1 — tek sorumluluk: weeklyDigest.
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { effectivePlanKeyForWorkspace, resolveAccountPlanKey } from "@/lib/paddle";
import { analyzeCorpus } from "@/lib/ai/insights";
import { sendEmails } from "@/lib/email/send";
import { renderDigestEmail, shouldSendDigest } from "@/lib/email/digest";
import { getDb } from "@/lib/db";
import { listWorkspaceTeam } from "@/lib/db/membership";
import { posts, votes, workspaceMembers, workspaces } from "@/lib/db/schema";
import { inngest } from "../client";
import { MAX_CORPUS } from "./shared";

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    retries: 2,
    concurrency: 1,
    triggers: { cron: "0 6 * * 1" },
  },
  async ({ step }) => {
    const candidates = await step.run("load-pro-workspaces", async () => {
      // 2026-09-12 — hesap düzeyi Pro dahil: haftalık özet Pro özelliğidir
      // (`shouldSendDigest`), ve artık "owner'ın başka bir Pro workspace'i
      // varsa bu workspace de Pro" kuralı geçerli. Kural owner ilişkisi
      // gerektirdiği için SQL'de tek ifadeyle yazılamaz; workspace tablosu
      // küçük olduğundan plan satırları + owner eşlemesi çekilip JS'te
      // değerlendirilir (haftada bir koşan bir iş için ölçüsüz değil).
      // Dunning grace kuralı `resolveAccountPlanKey`/`effectivePlanKey`
      // içindedir (denetim K3), burada tekrar yazılmaz.
      const db = getDb();
      const now = new Date();
      const [all, ownerRows] = await Promise.all([
        db
          .select({
            id: workspaces.id,
            name: workspaces.name,
            plan: workspaces.plan,
            paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
            paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
            lastSentAt: workspaces.digestLastSentAt,
          })
          .from(workspaces),
        db
          .select({
            workspaceId: workspaceMembers.workspaceId,
            userId: workspaceMembers.userId,
          })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.role, "owner")),
      ]);

      const ownedByUser = new Map<string, string[]>();
      for (const row of ownerRows) {
        const list = ownedByUser.get(row.userId);
        if (list) list.push(row.workspaceId);
        else ownedByUser.set(row.userId, [row.workspaceId]);
      }

      return all.filter((ws) => {
        const ownerIds = ownerRows
          .filter((row) => row.workspaceId === ws.id)
          .map((row) => row.userId);
        const ownedIds = new Set(
          ownerIds.flatMap((userId) => ownedByUser.get(userId) ?? []),
        );
        const ownedRows = all.filter((candidate) => ownedIds.has(candidate.id));
        return resolveAccountPlanKey(ws, ownedRows, now) === "pro";
      });
    });

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

        // Alıcılar: workspace EKİBİ (owner/manager/member) ve digest
        // tercihi açık olanlar. Platform personeli dahil değil. Aynı kişi iki
        // Clerk kimliğiyle üye olabildiği için e-postaya göre tekilleştirilir
        // (aksi halde tek adrese iki özet giderdi).
        const team = (await listWorkspaceTeam(ws.id)).filter(
          (member) => member.emailDigest,
        );
        const recipients = [
          ...new Map(team.map((member) => [member.email, member])).values(),
        ];

        // Aday listesi hesap düzeyi kurala göre süzüldü, ama İÇ kontrol de
        // aynı kaynaktan okumalı: ham `effectivePlanKey(ws)` Free planlı bir
        // workspace'te (owner'ı Pro olsa bile) "free" der ve özeti sessizce
        // keserdi (2026-09-12).
        const plan = await effectivePlanKeyForWorkspace(ws.id);
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
