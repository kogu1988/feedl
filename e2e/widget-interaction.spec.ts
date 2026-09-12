import { expect, test, type Page } from "@playwright/test";

// Widget etkileşim kuralları (2026-09-12):
//  1) Araç çubuğu modları BİRBİRİNİ İPTAL EDER — "Fikir ara" açıkken
//     "Fikir gönder"e basmak arama alanını kapatır (önce ikisi de açık kalıp
//     panelde alt alta uzuyordu).
//  2) ESC her aşamada her şeyi iptal eder: panel, panel içindeki açık mod,
//     görsel (pin) modu. Paneldeki klavye host'a kabarcıklanmadığı için ESC
//     iframe içindeyken de çalışmak ZORUNDA — bu test o köprüyü doğrular.
//
// Test host sayfayı `page.route` ile servis eder: real müşteri sayfası yerine
// geçer ve widget'ı YEREL sunucuya (data-feedl-url) yönlendirir.
const BASE = "http://localhost:3000";

test.describe("widget etkileşimi", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/__widget-host", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>host</title></head>
<body><h1>host sayfa</h1>
<script src="/widget.js" data-feedl-url="${BASE}" data-feedl-workspace="feedl"
 data-button-text="Geri bildirim" async></script>
</body></html>`,
      });
    });
    await page.goto("/__widget-host");
    const launcher = page.locator(".feedl-widget-launcher");
    await expect(launcher).toBeVisible({ timeout: 15_000 });
  });

  // Hydration kapısı: "Görsel" butonu yalnız `embedded` (useEffect ile set
  // edilir) true olunca render edilir → görünmesi client'ın bağlandığını
  // KANITLAR. Bu beklenmeden yapılan tıklama hydration öncesine düşüp no-op
  // olabiliyor.
  async function openPanel(page: Page) {
    await page.locator(".feedl-widget-launcher").click();
    const frame = page.frameLocator("iframe.feedl-widget-iframe");
    await expect(frame.getByRole("button", { name: "Görsel" })).toBeVisible({
      timeout: 15_000,
    });
    return frame;
  }

  test("mod butonları birbirini iptal eder (ara ↔ gönder)", async ({ page }) => {
    const frame = await openPanel(page);
    const searchBtn = frame.getByRole("button", { name: "Fikir ara" });
    const formBtn = frame.getByRole("button", { name: "Fikir gönder" });
    const searchBox = frame.locator('input[type="search"]');

    await searchBtn.click();
    await expect(searchBtn).toHaveAttribute("aria-expanded", "true");
    await expect(searchBox).toBeVisible();

    // "Fikir gönder"e basmak aramayı KAPATIR.
    await formBtn.click();
    await expect(formBtn).toHaveAttribute("aria-expanded", "true");
    await expect(searchBtn).toHaveAttribute("aria-expanded", "false");
    await expect(searchBox).toBeHidden();

    // Geri dönüş de simetrik.
    await searchBtn.click();
    await expect(searchBtn).toHaveAttribute("aria-expanded", "true");
    await expect(formBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("ESC: odak iframe'deyken panel tamamen kapanır", async ({ page }) => {
    const overlay = page.locator(".feedl-widget-overlay");
    const frame = await openPanel(page);
    await expect(overlay).toBeVisible();
    const searchBox = frame.locator('input[type="search"]');
    await frame.getByRole("button", { name: "Fikir ara" }).click();
    await expect(searchBox).toBeVisible();
    await searchBox.focus();

    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();

    // Yeniden açılışta panel TEMİZ olmalı: açık kalan arama alanı geri gelmez.
    const reopened = await openPanel(page);
    await expect(reopened.locator('input[type="search"]')).toBeHidden();
  });

  test("ESC: görsel (pin) modunu da iptal eder", async ({ page }) => {
    const frame = await openPanel(page);
    const vfLayer = page.locator(".feedl-vf-layer");

    await frame.getByRole("button", { name: "Görsel" }).click();
    await expect(vfLayer).toBeVisible();
    // Görsel mod başlarken panel kapanır.
    await expect(page.locator(".feedl-widget-overlay")).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(vfLayer).toBeHidden();
  });

  // Yüzey politikası (dogfood): feedl'in kendi host'unda yalnız landing +
  // roadmap + changelog widget'ı taşır; `/portal` ve `/dashboard*` TAŞIMAZ —
  // portal zaten geri bildirim panosunun kendisi (widget "feedl içinde feedl"
  // iç içe iframe olurdu), dashboard ise operatör yüzeyidir. Ayrıca girişli
  // workspace üyesi widget'ı GÖRMEZ (operatör, geri bildirim kaynağı değil) —
  // o kapı sunucuda (`feedl-widget-self-embed.tsx` → `getTeamUserId`) olduğu
  // için anonim testte görünmez; müşteri host'u negatifi de aynı şekilde
  // (`isShowcaseRequest`) sunucuda ve burada test EDİLEMEZ (Host başlığı
  // Chromium'da değiştirilemiyor).
  //
  // 2026-09-12 (canlı hata): widget düğümleri `document.body`'de React'in
  // DIŞINDA yaşadığı için client gezinmede hayalet balon kalıyordu; aşağıdaki
  // testler o regresyonu ve izinli yüzeyler arası gezinmede titreme olmamasını
  // kilitler.
  test("self-embed yalnız beklenen yüzeylerde; çıkışta hayalet balon kalmaz", async ({
    page,
  }) => {
    for (const route of ["/", "/roadmap", "/changelog"]) {
      await page.goto(route);
      await expect(
        page.locator(".feedl-widget-launcher"),
        `${route} widget'ı taşımalı`,
      ).toBeVisible({ timeout: 15_000 });
    }

    // İZİNLİ yüzeyler arası CLIENT gezinme: widget yerinde kalmalı (sökülüp
    // yeniden kurulursa iframe her gezinmede yeniden yüklenir = titreme).
    await page.goto("/roadmap");
    await expect(page.locator(".feedl-widget-launcher")).toBeVisible({ timeout: 15_000 });
    await page
      .locator("header nav")
      .getByRole("link", { name: "Güncellemeler" })
      .click();
    await expect(page).toHaveURL(/\/changelog/);
    await expect(page.locator(".feedl-widget-launcher")).toBeVisible();

    // İZİNLİ yüzeyden ÇIKIŞ: hayalet balon ve script kalmamalı.
    await page.locator("header nav").getByRole("link", { name: "Portal" }).click();
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.locator(".feedl-widget-launcher")).toHaveCount(0);
    await expect(page.locator('script[src$="/widget.js"]')).toHaveCount(0);
  });
});
