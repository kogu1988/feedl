"use client";

import type { AnalyticsEventName, AnalyticsProps } from "./names";

// Sprint 65 — CLIENT tarafı analitik (yalnız GA4 mirror).
//
// Neden client'ta da var: huninin en üstündeki `visitor` adımı anonimdir ve
// sunucuda kimliği yoktur; ayrıca `upgrade_clicked` gibi tıklama olayları
// kullanıcı eyleminin anında tetiklenmesi gereken olaylardır.
//
// Neden BİRİNCİL kaynak değil: ad-blocker GA isteğini düşürür. Kalıcı kayıt
// sunucudaki `analytics_events` tablosudur (lib/analytics/events.ts). Buradaki
// çağrı yalnız GA4'ün kendi raporlarında korelasyon için bir aynadır.
//
// GA_ID yoksa tamamen no-op — davranış değişmez (bkz. google-analytics.tsx).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * GA4'e özel olay gönderir. `window.gtag` yoksa (GA yapılandırılmamış veya
 * reklam engelleyici script'i düşürmüş) sessizce no-op olur.
 */
export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, props ?? {});
  } catch {
    /* Analitik asla kullanıcı akışını bozmaz. */
  }
}
