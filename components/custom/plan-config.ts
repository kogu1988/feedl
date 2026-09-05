"use client";

// Sprint 52 (Faz 5) — plan fiyat yapılandırmasının TEK kaynağı. Hem
// dashboard/billing-manager hem public pricing-manager buradan okur —
// fiyat/price-id/period tutarlılığı ve sandbox↔live karışması önlenir.
// Değerler env'den gelir (PUBLIC olduğundan client erişebilir); canlıya
// geçişte aynı env'lere production değerleri yazılır.

export type PlanEnv = "sandbox" | "live";

export function getPlanEnv(): PlanEnv {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "live";
}

// Pro fiyatlandırma: aylık ve yıllık (yıllık = ayda eşdeğer + toplam).
// Paddle'da fiyatlar USD; gösterim burada merkezi.
export const PRO_PLAN = {
  monthlyPrice: "$19",
  yearlyMonthlyPrice: "$15",
  yearlyTotal: "$180",
  // Paddle price ID'leri (sandbox = mevcut, canlı = production env).
  monthlyPriceId: process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? "",
  yearlyPriceId: process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? "",
} as const;

export function isPro(plan: string): boolean {
  return plan === "pro";
}
