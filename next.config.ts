import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 2026-09-12 (kullanıcı: "her sekme değişiminde sorgu atmasın").
    //
    // Next'in CLIENT router cache'i. Varsayılan `dynamic: 0` olduğu için
    // `force-dynamic` dashboard'da aynı sayfa içinde sekme/filtre değiştirmek
    // HER SEFERİNDE sunucuya gidip Neon sorgularını yeniden çalıştırıyordu
    // (üstelik `no-store` client önbelleğini kapatır).
    //
    //  dynamic: 30 → 30 sn içinde geri dönülen sekme sunucuya HİÇ gitmez.
    //  static: 300 → varsayılan korunur (marketing sayfaları).
    //
    // Tazelik güvencesi: kendi mutation'larımız sonrası `router.refresh()`
    // çağrılır (ekle/düzenle/sil akışlarının tamamı) ve bu client cache'i
    // geçersiz kılar — yani KENDİ değişikliğimiz her zaman anında görünür.
    // Takas: başka bir kullanıcının değişikliği en fazla 30 sn geç görünebilir
    // (admin konsolu için kabul edilebilir; kısa tutuldu).
    staleTimes: { dynamic: 30, static: 300 },
  },
  async redirects() {
    return [
      // Changelog 2026-09-05'te /portal altından üst seviyeye taşındı
      // (/changelog) — canlıdaki eski URL'ler geçici redirect ile korunur.
      { source: "/portal/changelog", destination: "/changelog", permanent: false },
      {
        source: "/portal/changelog/:id",
        destination: "/changelog/:id",
        permanent: false,
      },
      // 2026-09-12 — Belirli bir rakip aracın adını taşıyan karşılaştırma
      // sayfası araç-bağımsız hâle getirildi ve rota `/alternative` oldu.
      // Eski URL 308 ile devredilir: indekslenmiş linkler ve dış bağlantılar
      // kırılmasın, SEO değeri yeni URL'e taşınsın.
      // NOT: 308 (kalıcı) — arama motorları eski yolu bırakıp yenisini
      // indeksler. `/alternative` public-paths allowlist'indedir.
      {
        source: "/canny-alternative",
        destination: "/alternative",
        permanent: true,
      },
    ];
  },
};

// Sprint 63w (B1) — Sentry Next.js SDK. `silent: true`, `authToken` yoksa CI
// source-map upload atlanır (build'i kırmaz). DSN runtime'da env'den okunur.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
});
