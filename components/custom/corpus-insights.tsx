"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";

// Sprint 61 (corpus AI içgörüleri) — feedback korpusundan üretilen temalar,
// trendler, hızlı kazanımlar, riskler ve ürün önerisi. LLM çıktısı gösterilir;
// "Yenile" ile tekrar üretilir (maliyetli — dikkatli kullan).
export interface CorpusInsightsView {
  themes: { name: string; count: number; summary: string }[];
  trends: { name: string; note: string }[];
  quickWins: string[];
  risks: { label: string; detail: string }[];
  recommendation: string;
}

export function CorpusInsights({ data }: { data: CorpusInsightsView }) {
  return (
    <div className="mt-8 grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Öneri</CardTitle>
          <CardDescription>
            Bu korpusa göre ilk yapılması gereken ürün kararı.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.recommendation}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Temalar ({data.themes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.themes.map((t, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {t.count} istek
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{t.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Trendler ({data.trends.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.trends.map((t, i) => (
                  <li key={i}>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground"> — {t.note}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riskler ({data.risks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.risks.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium text-destructive">{r.label}</span>
                    <span className="text-muted-foreground"> — {r.detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {data.quickWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hızlı Kazanımlar ({data.quickWins.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.quickWins.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RefreshInsightsButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.location.reload()}
    >
      <RefreshCwIcon aria-hidden="true" />
      Yenile
    </Button>
  );
}
