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
      // 2026-09-13 — Ayrı `/pricing` sayfası KALDIRILDI (kullanıcı kararı):
      // plan kartları ve satın alma akışı zaten ana sayfadaki `#pricing`
      // bölümünde (aynı `PricingManager`). İki yüzey aynı şeyi gösterdiği için
      // bakım yükü ve yanlış senkron riski vardı.
      // 308 (kalıcı): eski bağlantılar ve arama motoru sonuçları ana sayfaya
      // devredilir; `/pricing` artık hiçbir yüzeyde bağlantı almıyor.
      { source: "/pricing", destination: "/#pricing", permanent: true },
      // Changelog 2026-09-05'te /portal altından üst seviyeye taşındı
      // (/changelog) — canlıdaki eski URL'ler geçici redirect ile korunur.
      { source: "/portal/changelog", destination: "/changelog", permanent: false },
      {
        source: "/portal/changelog/:id",
        destination: "/changelog/:id",
        permanent: false,
      },
      // 2026-09-13 — Marka adı taşıyan karşılaştırma rotası ("<rakip>-alternative")
      // ve ona ait 308 yönlendirmesi TAMAMEN kaldırıldı: hem yasal risk
      // taşıyordu hem de ürünü "X'in yerine geçen araç" diye tanımlıyordu.
      // Araç-bağımsız karşılaştırma sayfası `/alternative` üzerinden yayında.
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
