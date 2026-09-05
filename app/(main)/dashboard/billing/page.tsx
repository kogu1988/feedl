import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { BillingManager } from "@/components/custom/billing-manager";
import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48h (Faz 5) — abonelik/faturalandırma. Workspace plan bilgisini
// gösterir; Pro'ya yükseltme Paddle.js checkout ile (billing-manager client).
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
          Planını ve kullanım limitlerini gösterir. Pro&apos;ya geçişle tüm
          özellikleri aç.
        </p>
      </div>

      {loadError || !data ? (
        <p className="mt-6 text-sm text-destructive">
          Faturalandırma bilgisi yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <BillingManager
          plan={data.plan}
          paddleSubscriptionId={data.paddleSubscriptionId}
          paddleCustomerId={data.paddleCustomerId}
          paddleSubscriptionStatus={data.paddleSubscriptionStatus}
          workspaceSlug={data.slug}
          pricing={{
            monthlyPriceId:
              process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? "",
            yearlyPriceId: process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? "",
          }}
        />
      )}
    </main>
  );
}

async function loadWorkspace() {
  const [row] = await getDb()
    .select({
      plan: workspaces.plan,
      paddleSubscriptionId: workspaces.paddleSubscriptionId,
      paddleCustomerId: workspaces.paddleCustomerId,
      paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      slug: workspaces.slug,
    })
    .from(workspaces)
    .where(eq(workspaces.id, await getWorkspaceId()))
    .limit(1);
  if (!row) throw new Error("Workspace bulunamadı.");
  return row;
}
