// Canlıda görsel geri bildirim akışını uçtan uca çalıştırır:
//   launcher → panel → "Görsel" → pin → form → Gönder → ekran görüntüsü
// Ardından POST yanıtını yakalar, Neon'dan kaydı ve alanlarını doğrular ve
// private-blob proxy route'unun middleware'den geçtiğini kontrol eder.
//
// Kullanım: node tools/e2e-visual-feedback.mjs [url]
//
// Not: feedl.app landing'i widget'ı kendi üzerinde (feedl workspace) gömülü
// çalıştırır → canlı E2E buradan yapılabilir. Test, dogfood workspace'inde
// GERÇEK bir görsel geri bildirim kaydı oluşturur (başlığı "E2E görsel …").
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

const url = process.argv[2] ?? "https://feedl.app/";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sql = neon(env.DATABASE_URL);

const marker = `E2E görsel ${new Date().toISOString().slice(0, 19)}`;
// Tıklanacak nokta (viewport koordinatı). Ekran görüntüsü tam-sayfa olduğu
// için testte sayfa en üste kaydırılır → doküman koordinatı = bu değer.
const MARK_X = 320;
const MARK_Y = 420;
// Sayfa bir miktar kaydırılır: yeni yakalama "görünür alanı" çektiği için
// kaydırma sonrası işaretin görüntüde doğru yere oturması da test edilir.
const SCROLL_Y = 600;
console.log("URL:", url);
console.log("marker:", marker);
console.log("işaret noktası (viewport):", MARK_X, MARK_Y, "· kaydırma:", SCROLL_Y);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
});

// POST yanıtını yakala (durum + gövde: id ve screenshot bayrağı).
let post = null;
page.on("response", async (res) => {
  if (
    res.url().includes("/api/widget/visual-feedback") &&
    res.request().method() === "POST"
  ) {
    let json = null;
    try {
      json = await res.json();
    } catch {}
    post = { status: res.status(), json };
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
// Determinizm: sayfayı belirli bir miktar kaydır ve orada bırak.
await page.evaluate((y) => window.scrollTo(0, y), SCROLL_Y);
await page.waitForTimeout(400);

const launcher = page.locator(".feedl-widget-launcher");
await launcher.waitFor({ state: "visible", timeout: 15000 });
await launcher.click();

const frame = page.frameLocator(".feedl-widget-iframe");
await frame.locator("body").waitFor({ timeout: 15000 });

await frame.getByRole("button", { name: "Görsel geri bildirim" }).click();
await page.waitForTimeout(700);

const layerVisible = await page.locator(".feedl-vf-layer").isVisible();
console.log(`${layerVisible ? "✅" : "❌"} pin katmanı açıldı: ${layerVisible}`);
if (!layerVisible) {
  if (errors.length) console.log("hatalar:\n" + errors.slice(0, 8).join("\n"));
  await context.close();
  await browser.close();
  process.exit(1);
}

// Bir noktaya tıkla → pin + form.
await page.mouse.click(MARK_X, MARK_Y);
const titleInput = page.locator('.feedl-vf-form [data-vf="title"]');
await titleInput.waitFor({ state: "visible", timeout: 5000 });
const fields = await page.locator(".feedl-vf-form input, .feedl-vf-form textarea").count();
console.log(`${fields === 2 ? "✅" : "❌"} pin + form alanları: ${fields}`);

await titleInput.fill(marker);
await page
  .locator('.feedl-vf-form [data-vf="desc"]')
  .fill("E2E: checkout butonu mobilde ekran dışına taşıyor (otomatik test kaydı).");
await page.locator(".feedl-vf-send").click();

// Sonuç: BAŞARI toast'ı ("Teşekkürler") veya hata durumu.
let outcome = "timeout";
try {
  await page
    .locator(".feedl-vf-toast", { hasText: "Teşekkürler" })
    .waitFor({ state: "visible", timeout: 40000 });
  outcome = "toast";
} catch {
  const t = page.locator(".feedl-vf-toast");
  if ((await t.count()) > 0 && (await t.isVisible())) {
    outcome = "toast-error: " + (await t.innerText());
  } else {
    const msg = page.locator(".feedl-vf-msg");
    if ((await msg.count()) > 0 && (await msg.isVisible())) {
      outcome = "form-error: " + (await msg.innerText());
    }
  }
}
console.log(`${outcome === "toast" ? "✅" : "❌"} UI sonucu: ${outcome}`);

for (let i = 0; i < 80 && !post; i++) await page.waitForTimeout(250);
console.log(
  "POST /api/widget/visual-feedback →",
  post ? `${post.status} ${JSON.stringify(post.json)}` : "(yanıt yakalanmadı)",
);

if (outcome === "toast") {
  let row = null;
  for (let i = 0; i < 20 && !row; i++) {
    const rows = await sql.query(
      `select id, source,
              pin_x::float8 as pin_x, pin_y::float8 as pin_y,
              device_type, viewport_width, viewport_height, browser, os,
              page_url, screenshot_url, widget_origin
         from posts where title = $1 limit 1`,
      [marker],
    );
    row = rows[0] ?? null;
    if (!row) await page.waitForTimeout(500);
  }

  if (!row) {
    console.log("❌ DB'de kayıt bulunamadı");
  } else {
    const checks = [
      ["source = visual_feedback", row.source === "visual_feedback"],
      ["pin_x/pin_y dolu (0-100)", row.pin_x != null && row.pin_y != null],
      ["device_type dolu", !!row.device_type],
      ["viewport dolu", row.viewport_width != null && row.viewport_height != null],
      ["browser dolu", !!row.browser],
      ["os dolu", !!row.os],
      ["page_url dolu", !!row.page_url],
      ["screenshot_url (private blob)", !!row.screenshot_url],
      ["widget_origin dolu", !!row.widget_origin],
    ];
    for (const [label, ok] of checks) console.log(`${ok ? "✅" : "❌"} ${label}`);
    console.log("kanıt:", JSON.stringify(row));
    console.log("post id:", row.id);
    console.log(`doğrulama: node tools/verify-visual-image.mjs ${row.id} oguzkir@gmail.com ${MARK_X} ${MARK_Y}`);
  }
}

// Proxy route Clerk middleware'den geçiyor mu? Oturumsuz 401 JSON beklenir;
// 404 HTML dönerse route public matcher'da DEĞİL demektir.
const origin = new URL(url).origin;
const proxy = await fetch(
  `${origin}/api/visual-feedback/image?postId=00000000-0000-0000-0000-000000000000`,
);
const proxyText = await proxy.text();
console.log(
  `${proxy.status === 401 ? "✅" : "⚠️ "} görsel proxy (oturumsuz, 401 beklenir): ` +
    `${proxy.status} ${proxyText.slice(0, 80)}`,
);

if (errors.length) console.log("sayfa hataları:\n" + errors.slice(0, 8).join("\n"));

await context.close();
await browser.close();
