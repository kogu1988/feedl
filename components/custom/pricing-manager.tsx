"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check } from "lucide-react";

// Sprint 49 (Faz 5) — public /pricing. Free vs Pro karşılaştırma tablosu;
// "Pro'ya Geç" Paddle.js sandbox/live overlay checkout'u açar (webhook
// provisioning'dan sorumludur). Slug workspace'te satırı ile eşleştirilir.
// Kullanıcı kararı: canlı tahsilata geçilmedi — sandbox'ta hazır bekler.

const env = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "live";
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

const tiers = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "sonsuza dek",
    highlight: false,
    cta: "Hemen Başla",
    features: [
      "1 board",
      "1 üye",
      "50 takipçi",
      "Fikir + oy + yorum",
      "AI etiketleme & özet",
      "Yol haritası & changelog",
      "Temel dahil etme (widget)",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "/ay",
    highlight: true,
    cta: "Pro'ya Geç",
    features: [
      "Sınırsız board",
      "10 üye",
      "Sınırsız takipçi",
      "Özel alan adı + marka kaldırma",
      "Özel kategoriler/alanlar",
      "Gelişmiş planlama & gelir skoru",
      "API + webhook erişimi",
      "Toplu aksiyonlar & kayıtlı görünümler",
    ],
  },
];

export function PricingManager({ workspaceSlug }: { workspaceSlug: string }) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [error, setError] = useState<string | null>(null);
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

  function openCheckout(priceId: string) {
    setError(null);
    if (!paddle) {
      setError("Paddle hazır değil, tekrar dene.");
      return;
    }
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { slug: workspaceSlug },
    });
  }

  const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? "";
  const yearlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? "";

  return (
    <div className="space-y-8">
      {/* Yıllık/aylık geçiş */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border p-1 text-sm">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium ${
              !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Aylık
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 font-medium ${
              annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Yıllık <span className="opacity-70">%20 indirim</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tiers.map((tier) => {
          const price = annual && tier.key === "pro" ? "$15" : tier.price;
          const period =
            tier.key === "pro" ? (annual ? "/ay (yıllık)" : "/ay") : tier.period;
          return (
            <div
              key={tier.key}
              className={`rounded-2xl border p-6 ${
                tier.highlight
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{tier.name}</h2>
                {tier.highlight && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    Popüler
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{price}</span>
                <span className="text-sm text-muted-foreground">{period}</span>
              </div>
              {tier.key === "pro" && annual && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Yıllık faturalandırmayla ayda $15. Yıllık $180.
                </p>
              )}
              <ul className="mt-5 space-y-2.5 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  if (tier.key === "free") {
                    window.location.href = "/sign-up";
                  } else {
                    openCheckout(annual ? yearlyPriceId : monthlyPriceId);
                  }
                }}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
                  tier.highlight
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border bg-background hover:bg-muted"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
