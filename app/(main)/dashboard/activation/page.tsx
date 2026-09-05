import { redirect } from "next/navigation";

import { ActivationFunnel } from "@/components/custom/activation-funnel";
import { getTeamUserId } from "@/lib/auth/admin";
import { loadActivationFunnel } from "@/lib/db/activation";

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
  try {
    data = await loadActivationFunnel();
  } catch (err) {
    console.error(
      "ActivationPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Aktivasyon</h1>
        <p className="mt-2 text-muted-foreground">
          Platforma kayıt olan workspace&apos;lerin ürün döngüsünün hangi
          adımına kadar ilerlediğini izle.
        </p>
      </div>

      {loadError || !data ? (
        <p className="mt-6 text-sm text-destructive">
          Aktivasyon verisi yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <ActivationFunnel data={data} />
      )}
    </main>
  );
}
