import { count, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { emailDeliveries } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Sprint 63v (deliverability) — son 30 günün e-posta teslimat özeti. Gönderen
// itibarını (bounce/complaint oranı) gösterir. Platform geneli (SaaS operatör
// görüşü): email_deliveries tüm workspace'leri kapsar. Birim testleri saf.
export const dynamic = "force-dynamic";

async function loadDeliverability() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await getDb()
    .select({
      sent: count(),
      delivered: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'delivered')`,
      bounced: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'bounced')`,
      complained: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'complained')`,
    })
    .from(emailDeliveries)
    .where(gte(emailDeliveries.sentAt, since));
  const sent = Number(row?.sent ?? 0);
  const delivered = Number(row?.delivered ?? 0);
  const bounced = Number(row?.bounced ?? 0);
  const complained = Number(row?.complained ?? 0);
  const failed = bounced + complained;
  const bounceRate = sent > 0 ? (failed / sent) * 100 : 0;
  return { sent, delivered, bounced, complained, bounceRate };
}

export async function EmailDeliverabilityCard() {
  let data: { sent: number; delivered: number; bounced: number; complained: number; bounceRate: number } | null = null;
  try {
    data = await loadDeliverability();
  } catch (err) {
    console.error("EmailDeliverabilityCard failed:", err instanceof Error ? err.message : err);
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>E-posta Durumu</CardTitle>
          <CardDescription>Teslimat verisi yüklenemedi.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const riskTone =
    data.bounceRate > 5 ? "text-red-600 dark:text-red-400" : data.bounceRate > 2 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  // 2026-09-06: Tek kart bir kapsayıcıda "grid md:grid-cols-2" ile
  // sarılmıştı — tek çocuk ilk kolona düşüp genişlik diğer kartlardan
  // sapıyordu. Kart kabuğu artık diğer dashboard kartlarıyla aynı:
  // doğrudan <Card> (tam genişlik, kapsayıcı belirler).
  return (
    <Card>
      <CardHeader>
        <CardTitle>E-posta Durumu</CardTitle>
        <CardDescription>Son 30 günün teslimat özeti (Resend).</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Gönderilen</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{data.sent}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Teslim</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.delivered}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Bounce</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{data.bounced}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Şikâyet</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{data.complained}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Hatalı oran:{" "}
          <span className={`font-mono font-semibold ${riskTone}`}>
            {data.bounceRate.toFixed(1)}%
          </span>{" "}
          {data.bounceRate > 5
            ? "· Gönderen itibarı riski yüksek — adres listesini gözden geçir."
            : data.bounceRate > 2
              ? "· İzle — hedef %2'nin altı."
              : "· Sağlıklı."}
        </p>
      </CardContent>
    </Card>
  );
}
