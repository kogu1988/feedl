"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check, CreditCardIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import {
  getPlanEnv,
  isPro,
  PADDLE_CUSTOMER_PORTAL_URL,
  PRO_PLAN,
  PRO_TRIAL_DAYS,
} from "@/components/custom/plan-config";

// Sprint 63k (kullanıcı) — billing iki sütun:
//  sol: kullanım grafiği (üstte) + mevcut plan + Pro kartı (altta, aylık/yıllık
//       switch + "Pro'ya Geç")
//  sağ: ödeme geçmişi (Paddle müşteri portalı üzerinden — transaction'ları
//       feedl DB'de tutmuyoruz; portal URL setse buton + durum açıklaması)
const env = getPlanEnv();
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
const customerPortalUrl = PADDLE_CUSTOMER_PORTAL_URL;

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  trialing: "Deneme",
  canceled: "İptal edildi",
  past_due: "Ödeme gecikti",
  paused: "Askıda",
  dunned: "Tahsilat girişimi",
  expired: "Süresi doldu",
};

interface UsageProps {
  boards: number;
  members: number;
  tracked: number;
  boardLimit: number;
  memberLimit: number;
  trackedLimit: number;
}

export interface BillingOverviewProps {
  plan: string;
  paddleSubscriptionId: string | null;
  paddleSubscriptionStatus: string | null;
  workspaceSlug: string;
  pricing: { monthlyPriceId: string; yearlyPriceId: string };
  usage: UsageProps;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const over = used >= limit && limit !== Number.MAX_SAFE_INTEGER;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {used} / {limit === Number.MAX_SAFE_INTEGER ? "∞" : limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={over ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-brand"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingOverview({
  plan,
  paddleSubscriptionId,
  paddleSubscriptionStatus,
  workspaceSlug,
  pricing,
  usage,
}: BillingOverviewProps) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    if (!clientToken) return;
    initializePaddle({
      environment: env === "sandbox" ? "sandbox" : undefined,
      token: clientToken,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          setInfo("Ödeme tamamlandı, sayfa yenileniyor…");
          window.setTimeout(() => window.location.reload(), 2500);
        } else if (event.name === "checkout.closed") {
          setError("Ödeme tamamlanmadı. Tekrar deneyebilirsin.");
        }
      },
    })
      .then((p) => setPaddle(p))
      .catch(() => setError("Paddle yüklenemedi."));
  }, []);

  const pro = isPro(plan);
  const status = paddleSubscriptionStatus ?? "";
  const statusLabel = STATUS_LABELS[status] ?? null;
  const paymentIssue = status === "past_due" || status === "dunned";
  const proPrice = annual ? PRO_PLAN.yearlyMonthlyPrice : PRO_PLAN.monthlyPrice;

  function openCheckout() {
    setError(null);
    if (!paddle) {
      setError("Paddle hazır değil, tekrar dene.");
      return;
    }
    paddle.Checkout.open({
      items: [
        {
          priceId: annual ? pricing.yearlyPriceId : pricing.monthlyPriceId,
          quantity: 1,
        },
      ],
      customData: { slug: workspaceSlug },
    });
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      {/* SOL kolon: kullanım + planlar */}
      <div className="space-y-6">
        {/* Kullanım grafiği */}
        <div className="rounded-lg border p-5">
          <h2 className="text-base font-semibold">Kullanım</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mevcut planının kaynak limitleri ve ne kadarının kullanıldığı.
          </p>
          <div className="mt-4 space-y-4">
            <UsageBar label="Board" used={usage.boards} limit={usage.boardLimit} />
            <UsageBar label="Üye" used={usage.members} limit={usage.memberLimit} />
            <UsageBar label="Takipçi" used={usage.tracked} limit={usage.trackedLimit} />
          </div>
        </div>

        {/* Mevcut Plan */}
        <div className="rounded-lg border p-5">
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
          {!pro && paddleSubscriptionId && (
            <p className="mt-2 text-xs text-muted-foreground">
              Abonelik ID: {paddleSubscriptionId}
            </p>
          )}
        </div>

        {/* Pro Plan kartı (switch + buton) */}
        <div className="rounded-lg border border-primary bg-primary/5 p-5">
          <p className="text-sm font-medium">Pro Plan</p>
          <div className="mt-3 inline-flex items-center self-start rounded-full border p-1 text-xs">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={
                !annual
                  ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-full px-3 py-1 font-medium text-muted-foreground"
              }
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={
                annual
                  ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-full px-3 py-1 font-medium text-muted-foreground"
              }
            >
              Yıllık <span className="opacity-70">%20</span>
            </button>
          </div>
          <p className="mt-4 text-2xl font-bold">
            {proPrice}
            <span className="text-sm font-normal text-muted-foreground">/ay</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {annual
              ? `Yıllık faturalandırmayla ayda ${PRO_PLAN.yearlyMonthlyPrice} (yıllık ${PRO_PLAN.yearlyTotal}).`
              : `Aylık faturalandırmayla ayda ${PRO_PLAN.monthlyPrice}.`}{" "}
            {PRO_TRIAL_DAYS > 0 ? `${PRO_TRIAL_DAYS} gün ücretsiz deneme.` : ""}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {["Sınırsız board", "10 üye", "Özel domain + marka kaldırma", "API + webhook"].map(
              (f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ),
            )}
          </ul>
          {!pro ? (
            <div className="mt-4">
              <Button className="w-full" onClick={openCheckout}>
                Pro&apos;ya Geç
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Aktif abonelik: {paddleSubscriptionId ?? "—"}.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-emerald-700 dark:text-emerald-300">{info}</p>}
      </div>

      {/* SAĞ kolon: ödeme geçmişi */}
      <div className="rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-semibold">Ödeme Geçmişi</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Faturaları, başarılı / başarısız / bekleyen ödemeleri gösterir.
        </p>

        <div className="mt-4">
          {customerPortalUrl ? (
            <div className="grid gap-3">
              <EmptyState title="Ödemeler Paddle portalında">
                Geçmiş ödemeleri ve faturaları Paddle müşteri portalından
                görüntüleyebilirsin.
              </EmptyState>
              <Button
                variant="outline"
                className="w-full"
                render={
                  <a href={customerPortalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    Faturalandırmayı Yönet
                  </a>
                }
              >
                Faturalandırmayı Yönet
              </Button>
            </div>
          ) : (
            <EmptyState title="Henüz ödeme geçmişi yok">
              Paddle müşteri portalı yapılandırıldığında ödemeler ve faturalar
              burada görünür.
            </EmptyState>
          )}
        </div>

        {/* Durum açıklaması */}
        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Abonelik durumu</p>
          <p className="mt-1">
            {statusLabel
              ? `Şu an: ${statusLabel}.`
              : "Aktif abonelik yok — Free plan üzerindesin."}
          </p>
          {paymentIssue && (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Ödemeniz gecikmiş görünüyor; ödemeyi tamamlamak için portalı kullan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
