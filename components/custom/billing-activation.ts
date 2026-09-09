"use client";

// P0-1: Billing activation — ödeme tamamlandıktan sonra webhook'un DB'ye
// ulaşıp workspace'i Pro yapmasını BEKLEMEK yerine, aktif durum için server'ı
// poll eder. Böylece "paramı aldı ama hâlâ Free" yanılgısı ortadan kalkar.
//
// Kullanım (checkout.completed):
//   setInfo("Ödemeniz alındı, Pro aktivasyonu doğrulanıyor…");
//   const r = await pollProActivation();
//   if (r.activated) { setInfo("Pro aktif! Sayfa yenileniyor…"); reload; }
//   else setInfo(r.timeout ? "Ödemeniz alındı. Aktivasyon birazdan tamamlanır — sayfayı yenile." : "Aktivasyon doğrulanamadı.");

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 14; // ~21s — webhook genelde saniyeler içinde düşer.

export interface ActivationPollResult {
  activated: boolean;
  timeout: boolean;
  plan: string;
  status: string | null;
}

interface StatusSnapshot {
  pro: boolean;
  plan: string;
  status: string | null;
  priceId: string | null;
}

async function readStatus(): Promise<StatusSnapshot | null> {
  try {
    const res = await fetch("/api/paddle/status", { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { plan?: string; priceId?: string | null; paddleSubscriptionStatus?: string | null };
    };
    const data = json.data;
    if (!json.success || !data) return null;
    return {
      pro: data.plan === "pro",
      plan: data.plan ?? "free",
      status: data.paddleSubscriptionStatus ?? null,
      priceId: data.priceId ?? null,
    };
  } catch {
    return null;
  }
}

export async function pollProActivation(): Promise<ActivationPollResult> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const s = await readStatus();
    if (s?.pro) {
      return { activated: true, timeout: false, plan: s.plan, status: s.status };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  // Zaman aşımı — webhook hâlâ gelebilir; kullanıcıya net bilgi verilir.
  return { activated: false, timeout: true, plan: "free", status: null };
}

// P0-1 (in-app plan değişikliği): aylık↔yıllık geçişinde plan `pro` kalır,
// değişimi subscription'ın price_id'si yansıtır. Hedef priceId webhook'la
// `subscriptions` tablosuna düşene kadar poll eder.
export interface PlanChangePollResult {
  changed: boolean;
  timeout: boolean;
  plan: string;
}

export async function pollPlanChange(targetPriceId: string): Promise<PlanChangePollResult> {
  if (!targetPriceId) return { changed: true, timeout: false, plan: "pro" };
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const s = await readStatus();
    if (s && s.priceId === targetPriceId) {
      return { changed: true, timeout: false, plan: s.plan };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { changed: false, timeout: true, plan: "pro" };
}
