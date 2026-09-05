"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Sprint 60 (madde — activation funnel): Operator görünümü. Her adımın kaç
// workspace'e ulaştığını ve bir öncekine göre dönüşümünü (%) çubukla gösterir.
export interface ActivationFunnelView {
  totalWorkspaces: number;
  steps: { key: string; label: string; count: number; conversion: number }[];
}

export function ActivationFunnel({ data }: { data: ActivationFunnelView }) {
  const maxCount = Math.max(data.totalWorkspaces, 1);
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Aktivasyon Hunisi</CardTitle>
        <CardDescription>
          Kaç workspace hangi aşamaya ulaştı? Gerçek kullanıcılar geldikçe bu
          huni, ürünün nerede kaybettiğini gösterir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.totalWorkspaces === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz workspace yok.</p>
        ) : (
          <div className="grid gap-3">
            {data.steps.map((step, i) => (
              <div key={step.key} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    {step.label}
                  </span>
                  <span className="font-mono tabular-nums">
                    {step.count}/{data.totalWorkspaces}
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
      </CardContent>
    </Card>
  );
}
