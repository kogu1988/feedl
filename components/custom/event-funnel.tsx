"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Sprint 65 (2026-09-13) — OLAY TABANLI huni görünümü.
//
// ActivationFunnel'dan (veri varlığından türetilen) farkı: burada gerçekten
// tetiklenen `analytics_events` satırları sayılır. İkisi birlikte okunur —
// "ne oldu" (derived) ile "kaç kişi o adıma geldi" (event) arasındaki fark,
// huninin nerede sızdığını gösterir.
export interface EventFunnelView {
  windowDays: number;
  totalEvents: number;
  steps: { name: string; label: string; count: number; conversion: number }[];
  unknownNames?: string[];
}

export function EventFunnel({ data }: { data: EventFunnelView }) {
  const maxCount = Math.max(...data.steps.map((s) => s.count), 1);
  const empty = data.totalEvents === 0;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Huni Olayları (son {data.windowDays} gün)</CardTitle>
        <CardDescription>
          Kullanıcıların gerçekten geçtiği adımlar; birinci taraf ölçüm
          (reklam engelleyici ve 3. taraf olmadan). Adımlar arası dönüşüm
          yüzdesiyle birlikte gösterilir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            Bu pencerede henüz olay kaydedilmedi. Yeni kayıtlar geldikçe huni
            dolmaya başlar.
          </p>
        ) : (
          <div className="grid gap-3">
            {data.steps.map((step, i) => (
              <div key={step.name} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    {step.label}
                  </span>
                  <span className="font-mono tabular-nums">
                    {step.count}
                    <span className="ml-2 text-muted-foreground">
                      %{step.conversion}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{
                      width: `${Math.round((step.count / maxCount) * 100)}%`,
                      opacity: step.count === 0 ? 0.25 : 1,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {data.unknownNames && data.unknownNames.length > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Taksonomi dışı olay adları: {data.unknownNames.join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
