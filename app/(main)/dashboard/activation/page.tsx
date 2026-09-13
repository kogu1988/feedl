import { redirect } from "next/navigation";

import { ActivationFunnel } from "@/components/custom/activation-funnel";
import { EventFunnel } from "@/components/custom/event-funnel";
import { Notice } from "@/components/custom/notice";
import { getTeamUserId } from "@/lib/auth/admin";
import { loadActivationFunnel } from "@/lib/db/activation";
import { loadEventFunnel, loadUnknownEventNames } from "@/lib/db/analytics-funnel";

// Canlı veri.
export const dynamic = "force-dynamic";

// Sprint 60 (madde — activation funnel): Operator görünümü — tüm
// workspace'lerin hangi aşamaya ulaştığını ölçer.
export default async function ActivationPage() {
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  let data: Awaited<ReturnType<typeof loadActivationFunnel>> | null = null;
  let loadError = false;
  // Sprint 65 — olay tabanlı huni (birinci taraf ölçüm). Hata olsa bile
  // derived huni görünmeye devam etsin: iki yükleme bağımsız ele alınır.
  let eventFunnel: Awaited<ReturnType<typeof loadEventFunnel>> | null = null;
  let unknownNames: string[] = [];
  try {
    data = await loadActivationFunnel();
    eventFunnel = await loadEventFunnel(30);
    unknownNames = await loadUnknownEventNames(30);
  } catch (err) {
    console.error(
      "ActivationPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aktivasyon</h1>
        <p className="mt-2 text-muted-foreground">
          Platforma kayıt olan workspace&apos;lerin ürün döngüsünün hangi
          adımına kadar ilerlediğini izle.
        </p>
      </div>

      {loadError || !data ? (
        <Notice size="md" className="mt-6">
          Aktivasyon verisi yüklenemedi. Lütfen sayfayı yenile.
        </Notice>
      ) : (
        <>
          <ActivationFunnel data={data} />
          {eventFunnel ? (
            <EventFunnel data={{ ...eventFunnel, unknownNames }} />
          ) : null}
        </>
      )}
    </main>
  );
}
