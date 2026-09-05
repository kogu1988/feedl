"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

import { Button } from "@/components/ui/button";
import {
  getPlanEnv,
  isPro,
  PRO_PLAN,
} from "@/components/custom/plan-config";

// Sprint 48h/52 (Faz 5) — faturalandırma yönetimi. Paddle.js Overlay checkout'u
// Pro fiyatıyla başlatır; abonelik provisioning webhook'ta yapılır. Fiyat/price-id
// tek kaynak: PRO_PLAN (plan-config). Tüm butonlar Button komponenti.

const env = getPlanEnv();
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

export function BillingManager({
  plan,
  paddleSubscriptionId,
  pricing,
  workspaceSlug,
}: {
  plan: string;
  paddleSubscriptionId: string | null;
  pricing: { monthlyPriceId: string; yearlyPriceId: string };
  workspaceSlug: string;
}) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientToken) return;
    initializePaddle({
      environment: env === "sandbox" ? "sandbox" : undefined,
      token: clientToken,
      eventCallback: (event) => {
        // Provisioning webhook'ta (serverside); istemci sadece bilgi verir.
        if (event.name === "checkout.completed") {
          // Sayfa yenilendiğinde webhook planı günceller; kullanıcıya bilgi.
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

  const pro = isPro(plan);

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="flex items-center justify-between text-sm font-medium">
            Mevcut Plan
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
              {pro ? "Pro" : "Free"}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pro
              ? "Tüm özellikler açık. Yönetim Paddle üzerinden."
              : "Sınırlı özellikler — Pro&apos;a geçerek tamamını aç."}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Pro Plan</p>
          <p className="mt-2 text-2xl font-bold">
            {PRO_PLAN.monthlyPrice}
            <span className="text-sm font-normal text-muted-foreground">/ay</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Yıllıkta {PRO_PLAN.yearlyMonthlyPrice}/ay. Sınırsız board, 10 üye,
            özel domain, marka kaldırma.
          </p>
        </div>
      </div>

      {!pro ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCheckout(pricing.monthlyPriceId)}>
            Pro&apos;a Geç (aylık)
          </Button>
          <Button
            variant="outline"
            onClick={() => openCheckout(pricing.yearlyPriceId)}
          >
            Pro&apos;a Geç (yıllık, %20 indirim)
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aktif abonelik: {paddleSubscriptionId ?? "—"}. İptal için Paddle
          müşteri portalını kullan.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
