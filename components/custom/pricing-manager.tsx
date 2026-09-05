"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  getPlanEnv,
  PRO_PLAN,
} from "@/components/custom/plan-config";

// Sprint 49/52 (Faz 5) — public /pricing. Free vs Pro karşılaştırma tablosu;
// "Pro'ya Geç" Paddle.js sandbox/live overlay checkout'u açar (webhook
// provisioning'dan sorumludur). Slug workspace'te satırı ile eşleştirilir.
// Kullanıcı kararı: canlı tahsilata geçilmedi — sandbox'ta hazır bekler.
// Aylık/yıllık switch Pro kartının içindedir, varsayılan YILLIK; yıllıkta
// PRO_PLAN.yearlyMonthlyPrice, aylıkta PRO_PLAN.monthlyPrice. Butonlar kart
// içi altta aynı hizada (flex-col + mt-auto), hepsi Button komponenti.

const env = getPlanEnv();
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

const freeFeatures = [
  "1 board",
  "1 üye",
  "50 takipçi",
  "Fikir + oy + yorum",
  "AI etiketleme & özet",
  "Yol haritası & changelog",
  "Temel dahil etme (widget)",
];

const proFeatures = [
  "Sınırsız board",
  "10 üye",
  "Sınırsız takipçi",
  "Özel alan adı + marka kaldırma",
  "Özel kategoriler/alanlar",
  "Gelişmiş planlama & gelir skoru",
  "API + webhook erişimi",
  "Toplu aksiyonlar & kayıtlı görünümler",
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5 text-sm">
      {items.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingManager({ workspaceSlug }: { workspaceSlug: string }) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [error, setError] = useState<string | null>(null);
  // Varsayılan: yıllık seçili.
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    if (!clientToken) return;
    initializePaddle({
      environment: env === "sandbox" ? "sandbox" : undefined,
      token: clientToken,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          window.setTimeout(() => window.location.reload(), 2500);
        }
      },
    })
      .then((p) => setPaddle(p))
      .catch(() => setError("Paddle yüklenemedi."));
  }, []);

  function openProCheckout() {
    setError(null);
    if (!paddle) {
      setError("Paddle hazır değil, tekrar dene.");
      return;
    }
    paddle.Checkout.open({
      items: [
        {
          priceId: annual ? PRO_PLAN.yearlyPriceId : PRO_PLAN.monthlyPriceId,
          quantity: 1,
        },
      ],
      customData: { slug: workspaceSlug },
    });
  }

  const proPrice = annual ? PRO_PLAN.yearlyMonthlyPrice : PRO_PLAN.monthlyPrice;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {/* FREE kartı */}
        <div className="flex h-full flex-col rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Free</h2>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-muted-foreground">sonsuza dek</span>
          </div>
          <FeatureList items={freeFeatures} />
          <div className="mt-auto pt-6">
            <Button size="lg" variant="outline" className="w-full" render={<a href="/sign-up" />}>
              Hemen Başla
            </Button>
          </div>
        </div>

        {/* PRO kartı */}
        <div className="flex h-full flex-col rounded-2xl border border-primary bg-primary/5 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pro</h2>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              Popüler
            </span>
          </div>

          {/* Aylık/Yıllık switch — sadece Pro kartında */}
          <div className="mt-3 inline-flex items-center self-start rounded-full border p-1 text-xs">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                annual ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Yıllık <span className="opacity-70">%20 indirim</span>
            </button>
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">{proPrice}</span>
            <span className="text-sm text-muted-foreground">/ay</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {annual
              ? `Yıllık faturalandırmayla ayda ${PRO_PLAN.yearlyMonthlyPrice} (yıllık ${PRO_PLAN.yearlyTotal}).`
              : `Aylık faturalandırmayla ayda ${PRO_PLAN.monthlyPrice}.`}
          </p>

          <FeatureList items={proFeatures} />

          <div className="mt-auto pt-6">
            <Button size="lg" className="w-full" onClick={openProCheckout}>
              Pro&apos;ya Geç
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
