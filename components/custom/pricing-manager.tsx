"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRO_PLAN, PRO_TRIAL_DAYS } from "@/components/custom/plan-config";
import { useCheckout } from "@/components/custom/use-checkout";
import { CheckoutStatusBanner } from "@/components/custom/checkout-status";

// Sprint 49/52 (Faz 5) — public /pricing. Free vs Pro karşılaştırma tablosu;
// "Pro'ya Geç" Paddle.js sandbox/live overlay checkout'u açar (webhook
// provisioning'dan sorumludur). Slug workspace'te satırı ile eşleştirilir.
// Kullanıcı kararı: canlı tahsilata geçilmedi — sandbox'ta hazır bekler.
// Aylık/yıllık switch Pro kartının içindedir, varsayılan YILLIK; yıllıkta
// PRO_PLAN.yearlyMonthlyPrice, aylıkta PRO_PLAN.monthlyPrice. Butonlar kart
// içi altta aynı hizada (flex-col + mt-auto), hepsi Button komponenti.

const freeFeatures = [
  "1 board · 1 üye · 50 takipçi",
  "Fikir + oy + yorum",
  "AI etiketleme & tek post özeti",
  "Yol haritası & changelog",
  "Widget gömülü (kendi sitende)",
  "\"Powered by feedl\" rozeti",
];

const proFeatures = [
  "Sınırsız board · 10 üye · sınırsız takipçi",
  "Özel alan adı + marka kaldırma",
  "Entegrasyonlar (Slack, Zendesk, Intercom, Jira, Linear)",
  "AI içgörüleri (korpus analizi)",
  "Private board'lar",
  "API + webhook erişimi",
  "Gelişmiş planlama & gelir skoru",
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

export function PricingManager({
  workspaceSlug,
  workspaceId,
  paddleCustomerId,
  successRedirect,
}: {
  workspaceSlug: string;
  // P0-2: immutable workspace UUID — billing identity (slug değişebilir).
  workspaceId?: string | null;
  paddleCustomerId?: string | null;
  // Girişli kullanıcı ödeme sonrası buraya yönlendirilir (ör. /dashboard).
  successRedirect?: string;
}) {
  // Varsayılan: yıllık seçili.
  const [annual, setAnnual] = useState(true);
  // Sprint 64: Paddle OVERLAY (default) — v1.6.5 INLINE stabil değil
  // (frameTarget string→"appendChild" undefined, element→JSON circular).
  const { openCheckout, status } = useCheckout({
    paddleCustomerId,
    workspaceId,
    workspaceSlug,
    successRedirect,
  });

  function openProCheckout() {
    openCheckout(annual ? PRO_PLAN.yearlyPriceId : PRO_PLAN.monthlyPriceId);
  }

  const proPrice = annual ? PRO_PLAN.yearlyMonthlyPrice : PRO_PLAN.monthlyPrice;

  return (
    <div className="space-y-8">
      <div className="grid items-stretch gap-6 md:grid-cols-2">
        {/* FREE kartı */}
        <div className="flex h-full flex-col rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Free</h2>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-muted-foreground">şimdilik ücretsiz</span>
          </div>
          <FeatureList items={freeFeatures} />
          <div className="mt-auto pt-5">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              render={<Link href="/sign-up" />}
            >
              Hemen Başla
            </Button>
          </div>
        </div>

        {/* PRO kartı */}
        <div className="flex h-full flex-col rounded-2xl border border-primary bg-primary/5 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pro</h2>
            <Badge className="border-transparent bg-primary text-primary-foreground">
              Popüler
            </Badge>
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
              : `Aylık faturalandırmayla ayda ${PRO_PLAN.monthlyPrice}.`}{" "}
            {PRO_TRIAL_DAYS > 0
              ? `${PRO_TRIAL_DAYS} gün ücretsiz deneme.`
              : ""}
          </p>

          <FeatureList items={proFeatures} />

          <div className="mt-auto pt-5">
            <Button size="lg" className="w-full" onClick={openProCheckout}>
              Pro&apos;ya Geç
            </Button>
          </div>
        </div>
      </div>

      {/* Şartlar notu — iki kartı dengede tutmak için kart DIŞINDA. Paddle
          ödeme ekranında şartları kabul ettirdiği için burada yalnız bilgi. */}
      <p className="text-center text-xs text-muted-foreground">
        Ödeme sırasında{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-primary">
          Kullanım Şartları
        </Link>{" "}
        ve{" "}
        <Link href="/refund" className="underline underline-offset-2 hover:text-primary">
          İade Politikası
        </Link>{" "}
        geçerlidir.
      </p>

      <CheckoutStatusBanner status={status} />
    </div>
  );
}
