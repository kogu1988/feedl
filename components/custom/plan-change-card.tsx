"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PRO_PLAN } from "@/components/custom/plan-config";

// Sprint 63x — in-app plan değişikliği (Pro ↔ faturalama dönemi). Mevcut Pro
// abonesi aylık↔yıllık geçişi Paddle sayfasına gitmeden yapar: önce önizleme
// (proration: bugün tahsil/credit), onaylayınca server PABLE update çağırır.
// Kullanıcı platformda kalır; webhook planı senkronlar.

interface PreviewData {
  updateSummary?: { credit: { amount: number } | null; charge: { amount: number } | null; result: string | null };
  immediate?: { total: { amount: number; currency: string } | null; billingPeriod: { endsAt: string } | null };
  recurring?: { amount: number; currency: string } | null;
}

function moneyStr(v: { amount: number; currency?: string } | null | undefined): string {
  if (!v) return "—";
  return `${v.currency ?? "USD"} ${v.amount.toFixed(2)}`;
}

export function PlanChangeCard({
  isPro,
  subscriptionId,
  monthlyPriceId,
  yearlyPriceId,
}: {
  isPro: boolean;
  subscriptionId: string | null;
  monthlyPriceId: string;
  yearlyPriceId: string;
}) {
  const [annual, setAnnual] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isPro || !subscriptionId) {
    // Yalnızca Pro + aktif abonelik için in-app plan değişikliği anlamlıdır.
    return null;
  }

  const targetPriceId = annual ? yearlyPriceId : monthlyPriceId;
  const targetLabel = annual
    ? `Yıllık (ayda ${PRO_PLAN.yearlyMonthlyPrice})`
    : `Aylık (${PRO_PLAN.monthlyPrice})`;

  async function previewChange() {
    setError(null);
    setInfo(null);
    setPreview(null);
    if (!targetPriceId) {
      setError("Hedef fiyat tanımlı değil.");
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/paddle/subscription/preview?priceId=${encodeURIComponent(targetPriceId)}`,
        { method: "GET" },
      );
      const json = (await res.json()) as { success?: boolean; data?: PreviewData; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Önizleme alınamadı.");
        return;
      }
      setPreview(json.data ?? null);
    } catch {
      setError("Önizleme alınamadı.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function applyChange() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/paddle/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: targetPriceId,
          prorationBillingMode: "prorated_immediately",
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Plan değiştirilemedi.");
        return;
      }
      setInfo("Plan değişikliği uygulandı, sayfa yenileniyor…");
      window.setTimeout(() => window.location.reload(), 2500);
    } catch {
      setError("Plan değiştirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  const charge = preview?.updateSummary?.charge;
  const credit = preview?.updateSummary?.credit;
  const immediate = preview?.immediate?.total;
  const recurring = preview?.recurring;

  return (
    <div className="mt-6 rounded-lg border p-5">
      <p className="text-sm font-semibold">Planı Değiştir {isPro ? "(in-app)" : ""}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Faturalama dönemini platformdan çıkmadan değiştir — tahsilat ve kredi
        Paddle üzerinden, buradaki önizlemede gösterilir.
      </p>

      <div className="mt-3 inline-flex items-center self-start rounded-full border p-1 text-xs">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={!annual ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground" : "rounded-full px-3 py-1 font-medium text-muted-foreground"}
        >
          Aylık
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={annual ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground" : "rounded-full px-3 py-1 font-medium text-muted-foreground"}
        >
          Yıllık <span className="opacity-70">%20</span>
        </button>
      </div>

      <div className="mt-3 text-sm">
        Hedef: <span className="font-medium">{targetLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={loadingPreview || busy} onClick={() => void previewChange()}>
          {loadingPreview ? "Hesaplanıyor…" : "Değişikliği Önizle"}
        </Button>
        {preview ? (
          <Button size="sm" disabled={busy} onClick={() => void applyChange()}>
            {busy ? "Uygulanıyor…" : "Onayla"}
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Önizleme</p>
          {charge ? (
            <p className="mt-1">Bugün tahsil: <span className="font-medium">{moneyStr(charge)}</span></p>
          ) : null}
          {credit ? (
            <p className="mt-1">Kredi: <span className="font-medium">{moneyStr(credit)}</span></p>
          ) : null}
          {immediate ? (
            <p className="mt-1">Anlık toplam: <span className="font-medium">{moneyStr(immediate)}</span></p>
          ) : null}
          {recurring ? (
            <p className="mt-1">Yinelenen: <span className="font-medium">{moneyStr(recurring)}</span>/dönem</p>
          ) : null}
          {!charge && !credit && !immediate && !recurring ? (
            <p className="mt-1">Aynı tutar — kredi/tahsilat yok.</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      {info ? <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{info}</p> : null}
    </div>
  );
}
