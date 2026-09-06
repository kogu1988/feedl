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

// Canlı hazırlık: Pro abonelik için Paddle tarafında da trial süresi/bedeli
// ürün üzerinde tanımlanır (kod değil, Paddle dashboard). Kod, webhook'ta
// `trialing` durumunu zaten 'pro' sayar; UI'da deneme süresini buradan göster.
export const PRO_TRIAL_DAYS = 14;

// **feedl_ öneki kuralı (Paddle paylaşımlı hesap — kullanıcı kararı):**
// Paddle'da başka bir projeye ait veriler olabileceğinden feedl'e ait tüm
// ürün/fiyat/indirim/webhook adları ve custom_data anahtarları `feedl_`
// önekiyle oluşturulur. Live fiyat ID'lerinin de bu kurala uyduğu doğrulanır;
// kod yalnızca env'den okur (yukarıda). Bu bir isimlendirme disiplinidir —
// koda doğrulama bağlanmaz (Paddle ID'leri Paddle'da üretilir, önek üretilen
// ada göre manuel verilir).

// Paddle müşteri portalı: Paddle.js v1 portal API'si sunmaz; portal HOSTED bir
// sayfa. Yönetici `NEXT_PUBLIC_PADDLE_CUSTOMER_PORTAL_URL` ile tam portal
// linkini set ederse buton açılır (güvenli, canlı geçişte Paddle'dan alınır).
export const PADDLE_CUSTOMER_PORTAL_URL =
  process.env.NEXT_PUBLIC_PADDLE_CUSTOMER_PORTAL_URL ?? "";
