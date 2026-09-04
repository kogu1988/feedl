import type { RevenueReport } from "@/lib/db/revenue-report";

// Sprint 45 (PM raporu §9 madde 9) — gelir raporu sunum bileşeni. Salt
// sunum; veri sunucuda hesaplanır (lib/db/revenue-report.ts).

const mrrFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("tr-TR");

function Money({ value }: { value: number }) {
  return (
    <span className="font-mono text-base font-bold tabular-nums">
      {mrrFormatter.format(value)}
    </span>
  );
}

export function RevenueReportView({ report }: { report: RevenueReport }) {
  const { summary } = report;

  const mrrTiles = [
    { label: "Toplam MRR", value: summary.totalMrr, tone: "default" },
    { label: "Aktif MRR", value: summary.activeMrr, tone: "good" },
    { label: "Risk altında", value: summary.atRiskMrr, tone: "warn" },
    { label: "Kaybedilen", value: summary.churnedMrr, tone: "bad" },
  ] as const;

  return (
    <div className="mt-6 grid gap-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          MRR özeti
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {mrrTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border p-3"
              data-tone={tile.tone}
            >
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1">
                <Money value={tile.value} />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {numberFormatter.format(summary.companyCount)} şirket
        </p>
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Segment MRR kırılımı
        </p>
        {report.bySegment.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz şirket yok. Şirketler sayfasından MRR gir.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {report.bySegment.map((segment) => (
              <li
                key={segment.segment ?? "null"}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {segment.segment ?? "Diğer"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {segment.companyCount} şirket
                  </p>
                </div>
                <Money value={segment.mrr} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Yenileme riski (90 gün)
          </p>
          {report.renewalRisk.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Yakın yenileme yok.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-lg border">
              {report.renewalRisk.map((item) => (
                <li
                  key={item.companyId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.daysUntilRenewal === 0
                        ? "Bugün"
                        : `${item.daysUntilRenewal} gün kaldı`}
                      {item.renewalDate ? ` · ${item.renewalDate}` : ""}
                    </p>
                  </div>
                  <Money value={item.mrr} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Churn adayları
          </p>
          {report.churnCandidates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Churn adayı yok.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-lg border">
              {report.churnCandidates.map((item) => (
                <li
                  key={item.companyId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <p className="text-sm font-medium">{item.name}</p>
                  <Money value={item.mrr} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dealbreaker fikirler (gelir etkisi en yüksek)
        </p>
        {report.dealbreakers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz gelir bağlantılı fikir yok.
          </p>
        ) : (
          <ol className="mt-2 divide-y rounded-lg border">
            {report.dealbreakers.map((item, index) => (
              <li key={item.postId} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.voteCount} oy · {item.customerCount} şirket
                  </p>
                </div>
                <Money value={item.revenueExposure} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
