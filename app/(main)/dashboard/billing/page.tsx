import { redirect } from "next/navigation";
import { count, eq, sql } from "drizzle-orm";

import { BillingOverview } from "@/components/custom/billing-overview";
import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { boards, workspaceMembers, workspaces } from "@/lib/db/schema";
import { PLANS, planFromString } from "@/lib/paddle";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48h (Faz 5) + 63k — abonelik/faturalandırma. İki sütun: solda kullanım
// grafiği + plan kartları, sağda ödeme geçmişi (Paddle portalı üzerinden).
// Üye sayımı workspace_members, board sayımı boards tablosundan gelir;
// takipçi (tracked) tahmini: workspace'e oy/posta düşen eşsiz kullanıcı sayısı
// yerine basitçe mevcut üye sayısı + plan limiti gösterilir (MVP).
export default async function BillingPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect(await getNonAdminRedirectTarget());
  }

  let data: Awaited<ReturnType<typeof loadWorkspace>> | null = null;
  let loadError = false;
  try {
    data = await loadWorkspace();
  } catch (err) {
    console.error("BillingPage load failed:", err instanceof Error ? err.message : err);
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturalandırma</h1>
        <p className="mt-2 text-muted-foreground">
          Planını, kullanım limitlerini ve ödemeni tek ekranda yönet.
        </p>
      </div>

      {loadError || !data ? (
        <p className="mt-6 text-sm text-destructive">
          Faturalandırma bilgisi yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <BillingOverview
          plan={data.plan}
          paddleSubscriptionId={data.paddleSubscriptionId}
          paddleSubscriptionStatus={data.paddleSubscriptionStatus}
          workspaceSlug={data.slug}
          pricing={{
            monthlyPriceId:
              process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? "",
            yearlyPriceId: process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? "",
          }}
          usage={data.usage}
        />
      )}
    </main>
  );
}

async function loadWorkspace() {
  const workspaceId = await getWorkspaceId();
  const [row] = await getDb()
    .select({
      plan: workspaces.plan,
      paddleSubscriptionId: workspaces.paddleSubscriptionId,
      paddleCustomerId: workspaces.paddleCustomerId,
      paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      slug: workspaces.slug,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error("Workspace bulunamadı.");

  const [boardRow] = await getDb()
    .select({ value: count(boards.id) })
    .from(boards)
    .where(eq(boards.workspaceId, workspaceId));
  const [memberRow] = await getDb()
    .select({ value: count(workspaceMembers.id) })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  // Gerçek tracked-user: workspace'te fikir POST eden veya OY veren eşsiz
  // kullanıcı sayısı (Canny'nin "tracked user" modeli — workspace_members
  // değil, gerçek katılımcı). İki küme birleştirilip eşsiz userId sayılır.
  const trackedRes = await getDb().execute(sql`
    SELECT count(DISTINCT u.user_id) AS value FROM (
      SELECT user_id FROM posts WHERE workspace_id = ${workspaceId}
      UNION
      SELECT v.user_id FROM votes v
      JOIN posts p ON p.id = v.post_id
      WHERE p.workspace_id = ${workspaceId}
    ) u
  `);
  const trackedRows = Array.isArray(trackedRes)
    ? trackedRes
    : (trackedRes?.rows ?? []);
  const trackedRow = trackedRows[0] as { value: number } | undefined;

  const plan = planFromString(row.plan);
  const limits = PLANS[plan];
  return {
    ...row,
    usage: {
      boards: Number(boardRow?.value ?? 0),
      members: Number(memberRow?.value ?? 0),
      tracked: Number(trackedRow?.value ?? 0),
      boardLimit: limits.boardLimit,
      memberLimit: limits.memberLimit,
      trackedLimit: limits.trackedUserLimit,
    },
  };
}
