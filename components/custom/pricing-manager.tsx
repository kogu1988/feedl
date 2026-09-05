"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Sprint 49 (Faz 5) — public /pricing. Free vs Pro karşılaştırma tablosu;
// "Pro'ya Geç" Paddle.js sandbox/live overlay checkout'u açar (webhook
// provisioning'dan sorumludur). Slug workspace'te satırı ile eşleştirilir.
// Kullanıcı kararı: canlı tahsilata geçilmedi — sandbox'ta hazır bekler.
// Aylık/yıllık switch Pro kartının içindedir, varsayılan YILLIK; yıllıkta
// aylık eşdeğeri ($15/ay), aylıkta $19/ay gösterilir. Butonlar kart içi
// altta aynı hizada (flex-col + mt-auto).

const env = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "live";
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? "";
const yearlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? "";

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
      items: [{ priceId: annual ? yearlyPriceId : monthlyPriceId, quantity: 1 }],
      customData: { slug: workspaceSlug },
    });
  }

  const proPrice = annual ? "$15" : "$19";
  const proPeriod = "/ay";

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
          <button
            type="button"
            onClick={() => {
              window.location.href = "/sign-up";
            }}
            className="mt-auto pt-6"
          >
            <div className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted">
              Hemen Başla
            </div>
          </button>
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
            <span className="text-sm text-muted-foreground">{proPeriod}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {annual
              ? "Yıllık faturalandırmayla ayda $15 (yıllık $180)."
              : "Aylık faturalandırmayla ayda $19."}
          </p>

          <FeatureList items={proFeatures} />

          <button
            type="button"
            onClick={openProCheckout}
            className="mt-auto pt-6"
          >
            <div className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Pro&apos;ya Geç
            </div>
          </button>
        </div>
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
