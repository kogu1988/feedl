import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Sprint 63y (F6) — erişilebilirlik denetimi. Ana herkese açık yüzeylerde axe
// taraması yapılır; kritik WCAG 2.1 ihlalleri (AA) reddedilir. Bu, B3'teki
// `test:e2e` parçasıdır; `npm run test:e2e` (çalışan sunucu gerekir) ile koşar.
// Sonuç: regresyonları yakalar — yeni eklenen bir bileşen a11y'yi bozarsa kırar.

const PUBLIC_ROUTES = ["/", "/portal", "/roadmap", "/changelog", "/pricing", "/demo"];

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
