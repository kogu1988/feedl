import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { CorpusInsights, type CorpusInsightsView } from "@/components/custom/corpus-insights";
import { InsightsRefreshButton } from "@/components/custom/insights-refresh-button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/custom/empty-state";
import { Notice } from "@/components/custom/notice";
import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// Canlı veri — ama LLM çağrısı YOK (arka planda Inngest).
export const dynamic = "force-dynamic";

// Sprint 63l — corpus AI içgörüleri artık ARKA PLANDA üretilir ve workspace
// üzerinde cache'lenir (workspaces.corpus_insights). Sayfa cache'i okur;
// "Yenile" /api/corpus-insights'a POST atar → Inngest üretir ve cache'ler.
// Böylece yavaş ücretsiz LLM yüzünden sayfa 500/blank olmaz.
export default async function InsightsPage() {
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  try {
    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({
        corpusInsights: workspaces.corpusInsights,
        corpusInsightsAt: workspaces.corpusInsightsAt,
        corpusInsightsStatus: workspaces.corpusInsightsStatus,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

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
          <EmptyState
            size="lg"
            title="Henüz AI içgörüsü yok"
            className="mt-8"
          >
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
