import { cn } from "@/lib/utils";
import {
  computePrioritySignal,
  computeRevenueScore,
  explainRevenueScore,
  type PostImpactContext,
  type PrioritySignal,
} from "@/lib/db/revenue-scores";

// 2026-09-12 (frontend_plan §4/§5/§6/§19/§26) — İŞ ETKİSİ kutusu.
//
// "Bu isteği yapmazsam ne kaybedebilirim?" sorusunu cevaplar (yalnız admin
// yüzeylerinde; §14: gelir bilgisi public tarafta GÖSTERİLMEZ).
//
// Tasarım kararları:
// - Rakamlar GERÇEK veriden gelir; uydurma değer yok. Veri yoksa `—`/yönlendirme
//   metni gösterilir (§5, §19). "$0 MRR" ile "veri yok" AYRI gösterilir.
// - Skor tek başına bir sayı değil: breakdown ile "neden bu skor?" açıklanır (§6).
// - Dil sade ve karar verici değil: "Öncelik sinyali" — AI/ürün karar vermez,
//   karar desteği verir (§26).

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export const PRIORITY_SIGNAL_LABELS: Record<PrioritySignal, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
  none: "—",
};

const signalClasses: Record<PrioritySignal, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export function BusinessImpact({
  voteCount,
  context,
  isPro = true,
  className,
}: {
  voteCount: number;
  context: PostImpactContext;
  // 2026-09-12 karar (kullanıcı): MRR/fırsat/skor Pro. frontend_plan §20
  // "Free'de sınırlı kullanım göster" önerisiyle uzlaşma: ETKİLENEN MÜŞTERİ
  // ve OY Free'de görünür (ikisi de Free özelliklerle besleniyor), gelir
  // satırları + skor/sinyal Pro'da açılır. Free'de MRR zaten girilemediği için
  // gizlenen satırlar veri kaybı değil.
  isPro?: boolean;
  className?: string;
}) {
  const score = computeRevenueScore({
    voteCount,
    customerCount: context.customerCount,
    mrrTotal: context.mrrTotal,
    openOpportunityValue: context.opportunityValue,
  });
  const signal = computePrioritySignal({
    voteCount,
    customerCount: context.customerCount,
    mrrTotal: context.mrrTotal,
    openOpportunityValue: context.opportunityValue,
  });
  const breakdown = explainRevenueScore({
    voteCount,
    customerCount: context.customerCount,
    mrrTotal: context.mrrTotal,
    openOpportunityValue: context.opportunityValue,
  });

  const hasCustomers = context.customerCount > 0;

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          İş etkisi
        </p>
        {isPro ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              signalClasses[signal],
            )}
            title="Oy, müşteri ve gelir verisinden türeyen sinyal — karar değil, karar desteği."
          >
            Öncelik sinyali: {PRIORITY_SIGNAL_LABELS[signal]}
          </span>
        ) : null}
      </div>

      <dl className="grid gap-1.5 text-sm">
        <Row label="Etkilenen müşteri">
          {hasCustomers ? (
            `${context.customerCount} müşteri`
          ) : (
            <span className="font-normal text-muted-foreground">—</span>
          )}
        </Row>

        {isPro ? (
          <>
            <Row label="Müşteri MRR'i">
              {context.mrrKnown ? (
                `$${money.format(context.mrrTotal)}`
              ) : (
                <span className="font-normal text-muted-foreground">—</span>
              )}
            </Row>

            <Row label="Potansiyel fırsat">
              {context.opportunityLinked ? (
                `$${money.format(context.opportunityValue)}`
              ) : (
                <span className="font-normal text-muted-foreground">—</span>
              )}
            </Row>
          </>
        ) : null}

        <Row label="Oy">{voteCount}</Row>

        {isPro ? <Row label="Öncelik skoru">{score}</Row> : null}
      </dl>

      {/* Skorun NEDENİ (§6) — kullanıcı çıplak "87" görmesin. */}
      {isPro ? (
        <details className="rounded-md border bg-muted/30 p-2.5 text-xs">
          <summary className="cursor-pointer font-medium">
            Bu skor nasıl hesaplandı?
          </summary>
          <ul className="mt-2 space-y-1">
            {breakdown.map((row) => (
              <li key={row.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {row.label}
                  <span className="ml-1 opacity-70">({row.detail})</span>
                </span>
                <span className="tabular-nums">
                  +{Math.round(row.contribution * 10) / 10}
                </span>
              </li>
            ))}
            <li className="mt-1 flex justify-between gap-3 border-t pt-1 font-medium">
              <span>Toplam</span>
              <span className="tabular-nums">{score}</span>
            </li>
          </ul>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">
          Müşteri MRR&apos;i, açık fırsatlar ve öncelik skoru Pro planda.
        </p>
      )}

      {/* Güvenli empty state'ler: kullanıcıya NE YAPACAĞINI söyle (§19). */}
      {!hasCustomers && !context.opportunityLinked ? (
        <p className="text-xs text-muted-foreground">
          Henüz müşteri etkisi verisi yok. Bir müşteri şirketi ekleyip üyelerini
          bu fikre yönlendirdiğinde etki burada görünür.
        </p>
      ) : (
        isPro && (
          <>
            {!context.mrrKnown ? (
              <p className="text-xs text-muted-foreground">
                Müşteri MRR&apos;i girilmemiş — gelir etkisini görmek için
                Şirketler&apos;den ekle.
              </p>
            ) : null}
            {!context.opportunityLinked ? (
              <p className="text-xs text-muted-foreground">
                Bağlı açık fırsat yok — bir fırsat bağlarsan potansiyel değer
                skora eklenir.
              </p>
            ) : null}
          </>
        )
      )}
    </div>
  );
}
