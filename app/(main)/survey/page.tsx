import { notFound } from "next/navigation";

import { generateCanonical } from "@/lib/seo";
import { isFeedlRootRequest } from "@/lib/db/workspace";

// 2026-09-13 — Ürün-dışı araştırma için ayrı, tam sayfa anket yüzeyi.
//
// KAPSAM AYRIMI (bilinçli): ÜRÜN geri bildirimi / özellik isteği feedl'in
// kendi toplama akışına (widget + portal) gider. Buradaki anket ise Tally ile
// yürütülen ürün-DIŞI araştırmadır (NPS, onboarding geri bildirimi, kullanıcı
// görüşmesi ön formu). İkisi farklı işler; bu yüzden Tally formu kendi
// sayfasında barındırılır, feedl'in geri bildirim akışına karışmaz.
//
// 1) HOST KAPISI: yalnız feedl kök host'unda render edilir. Bir müşterinin
//    alt alanında (`acme.feedl.app/survey`) feedl'in anketini doldurtmak
//    anlamsız olurdu (widget hayalet balonunda kapatılan sınıfın aynısı).
//    `isFeedlRootRequest()` istek bağlamı yoksa `true` döner (statik üretim
//    feedl markasıyla) — build DB'siz çalışabilsin.
// 2) İNDEKSLENMEZ: anket sonuçlarına organik arama trafiği istenmez.
//    metadata → `index: false` + robots.txt → `Disallow: /survey` (çift kapı).
// 3) GÖMME YÖNTEMİ: Tally'nin önerdiği `data-tally-src` + `embed.js` yerine
//    DÜZ `<iframe src>` kullanılır. Gerekçe: (a) embed.js yalnız otomatik
//    yükseklik/popup ve formEventsForwarding için gerekir; tam sayfa gömmede
//    iframe zaten viewport'u doldurur ve olay iletimi kullanılmaz, (b) üçüncü
//    taraf script'ini yüklememek daha az yüzey/JS ve JS engelliyken de çalışır,
//    (c) embed.js'in otomatik yeniden boyutlandırması tam sayfa yerleşimle
//    çakışabilir. `transparentBackground=1` düz iframe ile de çalışır.
const TALLY_FORM_URL = "https://tally.so/r/pbQG4b?transparentBackground=1";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Geri bildirim anketi",
    description:
      "feedl geri bildirim anketi — deneyimini paylaş, ürünü birlikte şekillendirelim.",
    robots: { index: false, follow: false },
    ...canonical,
  };
}

export default async function SurveyPage() {
  if (!(await isFeedlRootRequest())) notFound();

  // Yükseklik: sticky üst bar `h-14` (3.5rem) olduğu için kalan viewport'u
  // doldurur; `svh` mobilde adres çubuğu kaynaklı zıplamayı önler. Alt bar
  // (footer) içeriğin ALTINA düşer — anket tam ekran kalır.
  return (
    <main className="h-[calc(100svh-3.5rem)] w-full">
      <iframe
        src={TALLY_FORM_URL}
        title="feedl geri bildirim anketi"
        className="h-full w-full border-0"
      />
    </main>
  );
}
