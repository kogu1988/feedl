import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Sprint 63y (F6) — erişilebilirlik denetimi. Ana herkese açık yüzeylerde axe
// taraması yapılır; kritik WCAG 2.1 ihlalleri (AA) reddedilir. Bu, B3'teki
// `test:e2e` parçasıdır; `npm run test:e2e` (çalışan sunucu gerekir) ile koşar.
// Sonuç: regresyonları yakalar — yeni eklenen bir bileşen a11y'yi bozarsa kırar.

const PUBLIC_ROUTES = [
  "/",
  "/portal",
  "/roadmap",
  "/changelog",
  // 2026-09-13: `/pricing` KALDIRILDI (ana sayfaya 308 yönlendiriyor; kendi
  // sayfası yok). Plan kartları ana sayfada — o yüzden `/` taraması kapsıyor.
  "/demo",
  // 2026-09-12: Free/Pro rozetleri ve plan özetiyle yeniden yapılandırıldı —
  // SEO'ya açık bir yüzey olduğu için a11y taramasına alındı.
  "/how-to-collect-feedback",
  // 2026-09-14: ürün-içi kullanım rehberi (workspace/board/widget kurulumu)
  // — SEO'ya açık ve tablolar içerdiği için a11y taramasına alındı.
  "/how-to-use-feedl",
  // 2026-09-12: marka adı taşıyan rota kaldırılıp içerik araç-bağımsız hâle
  // getirildi (`/alternative`); SEO'ya açık yüzey olduğu için taramaya alındı.
  "/alternative",
  // 2026-09-14: yasal + iletişim sayfaları da taranıyor. Bunlar anonim
  // ziyaretçiye açık, indekslenen yüzeyler — regresyon (ör. kontrast/link
  // adı) sessizce yayına çıkmasın.
  "/privacy",
  "/terms",
  "/refund",
  "/contact",
];

// Kritik (AA) kural seti — salt bilgi/öneri olanları hariç tut.
const CRITICAL_RULES = [
  "color-contrast",
  "image-alt",
  "label",
  "button-name",
  "link-name",
  "select-name",
  "aria-allowed-attr",
  "aria-hidden-focus",
  "aria-required-children",
  "aria-required-parent",
  "landmark-one-main",
  "table-duplicate-name",
];

for (const route of PUBLIC_ROUTES) {
  test(`a11y: ${route} has no AA violations`, async ({ page }) => {
    await page.goto(route);
    // Yavaş başlangıç/fontlar -> denetim netleşsin.
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(
        // "landmark-unique" vs. gürültü; gerçek kritikler CRITICAL_RULES'te.
        ["landmark-unique", "region", "heading-order"],
      )
      .analyze();

    const violations = results.violations.filter((v) =>
      CRITICAL_RULES.includes(v.id),
    );

    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.nodes.length} nodes`).join("\n"),
    ).toEqual([]);
  });
}
