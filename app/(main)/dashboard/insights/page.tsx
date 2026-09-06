import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { CorpusInsights, type CorpusInsightsView } from "@/components/custom/corpus-insights";
import { InsightsRefreshButton } from "@/components/custom/insights-refresh-button";
import { EmptyState } from "@/components/custom/empty-state";
import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { getTeamUserId } from "@/lib/auth/admin";
import { getPlanLimits } from "@/lib/paddle";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// Canlı veri — ama LLM çağrısı YOK (arka planda Inngest).
export const dynamic = "force-dynamic";

// Sprint 63l — corpus AI içgörüleri arka planda üretilir, cache'lenir.
// Sprint 63n (kullanıcı): Pro özelliği — free workspace'te "Yenile" butonu yok;
// yerine Pro'ya yükseltme çağrısı. LLM maliyeti free'de üretilmez.
export default async function InsightsPage() {
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  try {
    const workspaceId = await getWorkspaceId();
    const planKey = (await getPlanLimits()).key;
    const [row] = await getDb()
      .select({
        corpusInsights: workspaces.corpusInsights,
        corpusInsightsStatus: workspaces.corpusInsightsStatus,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const isPro = planKey === "pro";

    // Free workspace → içgörü Pro kilitli. Cache'te eski içgörü varsa da göster.
    if (!isPro) {
      return (
        <main className="container mx-auto max-w-none p-4 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">AI İçgörüleri</h1>
          <p className="mt-2 text-muted-foreground">
            Geri bildirim korpusunu analiz eder — temalar, trendler, riskler ve
            hızlı kazanımlar.
          </p>
          <div className="mt-8 flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-8">
            <Button render={<Link href="/dashboard/billing" />}>
              Pro&apos;ya Yükselt
            </Button>
          </div>
        </main>
      );
    }

    const corpusInsights = (row?.corpusInsights ?? null) as CorpusInsightsView | null;
    const status = row?.corpusInsightsStatus ?? "idle";

    return (
      <main className="container mx-auto max-w-none p-4 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI İçgörüleri</h1>
            <p className="mt-2 text-muted-foreground">
              Geri bildirim korpusunu analiz eder — temalar, trendler, riskler ve
              hızlı kazanımlar. Analiz arka planda üretilir.
            </p>
          </div>
          <InsightsRefreshButton status={(row?.corpusInsightsStatus ?? "idle") as "idle" | "pending" | "done" | "error"} />
        </div>

        {status === "pending" ? (
          <Notice size="md" className="mt-8">
            Analiz başlatıldı — sonuç genellikle birkaç saniye içinde hazır olur.
            Burayı kapatıp tekrar kontrol edebilirsin.
          </Notice>
        ) : corpusInsights ? (
          <CorpusInsights data={corpusInsights} />
        ) : (
          <EmptyState size="lg" title="Henüz AI içgörüsü yok" className="mt-8">
            Portala ilk fikirleri gönder ve &quot;Yenile&quot;ye bas — korpus
            analizi arka planda üretilir.
          </EmptyState>
        )}
      </main>
    );
  } catch (err) {
    console.error("InsightsPage failed:", err instanceof Error ? err.message : err);
    return (
      <main className="container mx-auto max-w-none p-4 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">AI İçgörüleri</h1>
        <Notice size="md" className="mt-6">
          İçgörü verisi okunamadı. Lütfen sayfayı yenile.
        </Notice>
      </main>
    );
  }
}
