"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

import { Button } from "@/components/ui/button";
import { getPlanEnv, isPro, PRO_PLAN } from "@/components/custom/plan-config";

// Sprint 48h/52/60 (Faz 5) — faturalandırma yönetimi. Paddle.js Overlay
// checkout'u Pro fiyatıyla başlatır; abonelik provisioning webhook'ta yapılır.
// Sprint 60 (hardening): abonelik durumu gösterilir, ödeme gecikmesi uyarısı
// ve Paddle müşteri portalını açan "Faturalandırmayı Yönet" butonu eklendi.

const env = getPlanEnv();
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
// Paddle customer portal kimliği yapılandırıldıysa portal butonu çıkar.
const customerPortalId = process.env.NEXT_PUBLIC_PADDLE_CUSTOMER_PORTAL_ID ?? "";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  trialing: "Deneme",
  canceled: "İptal edildi",
  past_due: "Ödeme gecikti",
  paused: "Askıda",
  dunned: "Tahsilat girişimi",
  expired: "Süresi doldu",
};

export function BillingManager({
  plan,
  paddleSubscriptionId,
  paddleCustomerId,
  paddleSubscriptionStatus,
  workspaceSlug,
  pricing,
}: {
  plan: string;
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  paddleSubscriptionStatus: string | null;
  workspaceSlug: string;
  pricing: { monthlyPriceId: string; yearlyPriceId: string };
}) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [error, setError] = useState<string | null>(null);

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

  const pro = isPro(plan);
  const status = paddleSubscriptionStatus ?? "";
  const statusLabel = STATUS_LABELS[status] ?? null;
  // Ödeme problemi olan durumlar (past_due/dunned) → uyarı bandı.
  const paymentIssue = status === "past_due" || status === "dunned";

  return (
    <div className="mt-6 space-y-4">
      {paymentIssue && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Ödemeniz gecikmiş görünüyor. Pro özellikleri geçici olarak
          kısıtlanabilir — ödemeyi tamamlamak için aşağıdan
          &quot;Faturalandırmayı Yönet&quot; bölümünü kullan.
        </div>
      )}

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
              : "Sınırlı özellikler — Pro'ya geçerek tamamını aç."}
          </p>
          {statusLabel && (
            <p className="mt-2 text-xs">
              Abonelik: <span className="font-medium">{statusLabel}</span>
            </p>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Pro Plan</p>
          <p className="mt-2 text-2xl font-bold">
            {PRO_PLAN.monthlyPrice}
            <span className="text-sm font-normal text-muted-foreground">/ay</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Yıllıkta $15/ay. Sınırsız board, 10 üye, özel domain, marka kaldırma.
          </p>
        </div>
      </div>

      {!pro ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCheckout(pricing.monthlyPriceId)}>
            Pro&apos;ya Geç (aylık)
          </Button>
          <Button
            variant="outline"
            onClick={() => openCheckout(pricing.yearlyPriceId)}
          >
            Pro&apos;ya Geç (yıllık, %20 indirim)
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Aktif abonelik: {paddleSubscriptionId ?? "—"}.
          </p>
          {customerPortalId && paddleCustomerId && (
            <p className="text-xs text-muted-foreground">
              İptal ve faturalandırma yönetimi Paddle müşteri portalından yapılır
              (portal butonu yakında).
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
