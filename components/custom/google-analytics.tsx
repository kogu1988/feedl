"use client";

import Script from "next/script";

// Google Analytics 4 (gtag) — `NEXT_PUBLIC_GA_ID` setliyse yüklenir. Vercel
// Analytics yalnız hacim/trafik verir; GA4 ayrıca dönüşüm + etkinlik + arama
// konsolu içi keşif için. `afterInteractive` → sayfa etkileşimini bloklamaz.
// GA_ID yoksa hiçbir şey enjekte edilmez (no-op) — production'da env gerekir.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { page_path: window.location.pathname });
// Sprint 65 — huninin en üstü (anonim ziyaretçi). Kalıcı kayıt sunucudaki
// analytics_events tablosundadır; bu olay yalnız GA4 raporunda korelasyon
afor. Ad-blocker düşürürse huni bundan etkilenmez.
gtag('event', 'visitor', { page_path: window.location.pathname });`}
      </Script>
    </>
  );
}
