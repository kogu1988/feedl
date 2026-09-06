import { redirect } from "next/navigation";

import { IntegrationsPanel } from "@/components/custom/integrations-panel";
import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { getPlanLimits } from "@/lib/paddle";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 63k (kullanıcı): "Entegrasyonlar" ayrı sidebar menüsü — settings'ten
// taşındı. Slack/Zendesk/Intercom/Jira/Linear per-workspace bağlantıları burada.
export default async function IntegrationsPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect(await getNonAdminRedirectTarget());
  }

  // Entegrasyonlar Pro plan özelliğidir (Sprint 63o plan matrisi).
  const isPro = (await getPlanLimits()).key === "pro";

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Entegrasyonlar</h1>
        <p className="mt-2 text-muted-foreground">
          Slack, Zendesk, Intercom, Jira ve Linear&apos;ı workspace&apos;ine
          bağla — gelen destek/konuşmalar otomatik olarak fikre dönüşür.
        </p>
      </div>

      <div className="mt-8">
        <IntegrationsPanel isPro={isPro} />
      </div>
    </main>
  );
}
