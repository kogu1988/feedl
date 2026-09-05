import { redirect } from "next/navigation";

import { RevenueReportView } from "@/components/custom/revenue-report";
import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { loadRevenueReport } from "@/lib/db/revenue-report";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 45 (PM raporu §9 madde 9) — gelişmiş revenue/reporting:
// segment MRR, yenileme/churn riski, dealbreaker özellikler.
export default async function RevenuePage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect(await getNonAdminRedirectTarget());
  }

  let report: Awaited<ReturnType<typeof loadRevenueReport>> | null = null;
  let loadError = false;
  try {
    report = await loadRevenueReport();
  } catch (err) {
    console.error(
      "RevenuePage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Gelir Raporu</h1>
        <p className="mt-2 text-muted-foreground">
          Şirketlerin MRR ve fırsat verisinden gelir etkisi, risk ve en
          kritik fikirler.
        </p>
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">
          Gelir raporu yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : report ? (
        <RevenueReportView report={report} />
      ) : null}
    </main>
  );
}
