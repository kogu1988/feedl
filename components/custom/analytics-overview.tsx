import Link from "next/link";

import { ProFeatureLock } from "@/components/custom/pro";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { StatusBadge } from "@/components/custom/status-badge";

export interface AnalyticsData {
  rangeLabel: string;
  weekly: { ideas: number; votes: number; comments: number };
  sentiment: { pozitif: number; notr: number; negatif: number; unanalyzed: number };
  topPosts: { id: string; title: string; status: string; voteCount: number }[];
  // 2026-09-12 (frontend_plan P1-11) — Pro'ya özel gelir özeti. Sıralama ve
  // skor sunucuda üretilir (`revenueScoreOrderSql` + `computeRevenueScore`);
  // burada yalnız gösterilir. Free'de dizi boştur ve `isPro` false'tur.
  topRevenuePosts: {
    id: string;
    title: string;
    status: string;
    voteCount: number;
    customerCount: number;
    mrrTotal: number;
    score: number;
  }[];
  isPro: boolean;
}

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

// Sprint 29: dashboard temel analitikleri — salt sunum bileşeni. Veri
// dashboard sayfasında hesaplanır (haftalık sayaçlar DB'den, duygu
// dağılımı ve en çok istenenler mevcut fikir listesinden JS ile).
export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  const weeklyTiles = [
    { label: "Yeni Fikir", value: data.weekly.ideas },
    { label: "Yeni Oy", value: data.weekly.votes },
    { label: "Yeni Yorum", value: data.weekly.comments },
  ];

  const sentimentTiles = [
    { key: "pozitif", value: data.sentiment.pozitif },
    { key: "notr", value: data.sentiment.notr },
    { key: "negatif", value: data.sentiment.negatif },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.rangeLabel}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {weeklyTiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{tile.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Duygu dağılımı
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {sentimentTiles.map((tile) => (
            <span key={tile.key} className="inline-flex items-center gap-1.5">
              <SentimentBadge sentiment={tile.key} />
              <span className="text-sm font-semibold tabular-nums">
                {tile.value}
              </span>
            </span>
          ))}
          {data.sentiment.unanalyzed > 0 ? (
            <span className="text-sm text-muted-foreground">
              + {data.sentiment.unanalyzed} fikir henüz analiz edilmedi
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          En çok istenenler
        </p>
        {data.topPosts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz fikir yok.</p>
        ) : (
          <ol className="mt-2 divide-y rounded-lg border">
            {data.topPosts.map((post, index) => (
              <li key={post.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <Link
                  href={`/portal/${post.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {post.title}
                </Link>
                <StatusBadge status={post.status} />
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {post.voteCount} oy
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* frontend_plan P1-11: talebin yanına iş etkisi. Skor §6 gereği çıplak
          bir sayı değil — bileşenleri (müşteri sayısı + MRR) yanında durur ve
          fikir sayfasındaki tam breakdown'a götürür. Free'de kilit şablonu. */}
      {data.isPro ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Gelir etkisi en yüksek
          </p>
          {data.topRevenuePosts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Henüz gelir bağlamı yok. Fikirleri müşterilere bağla (ya da şirket
              MRR&apos;i gir) — bu liste oy, etkilenen müşteri ve açık fırsat
              değerine göre sıralanır.
            </p>
          ) : (
            <ol className="mt-2 divide-y rounded-lg border">
              {data.topRevenuePosts.map((post, index) => (
                <li key={post.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <Link
                    href={`/portal/${post.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {post.title}
                  </Link>
                  <StatusBadge status={post.status} />
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {post.score}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {post.voteCount} oy · {post.customerCount} müşteri
                      {post.mrrTotal > 0
                        ? ` · $${money.format(post.mrrTotal)} MRR`
                        : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <ProFeatureLock
          compact
          title="Gelir etkisi en yüksek"
          description="Oy + etkilenen müşteri + açık fırsat değerini birlikte tartan skorla sıralanır."
        />
      )}
    </div>
  );
}
