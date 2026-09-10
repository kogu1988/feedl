// Widget'ı uçtan uca gerçek tarayıcıda dener: launcher → panel → iframe →
// görsel geri bildirim butonu. Hem masaüstü hem mobil viewport'ta.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();

async function run(label, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
  });

  console.log("=".repeat(70));
  console.log(`${label} ${viewport.width}x${viewport.height}`);
  await page.goto("https://feedl.app/", { waitUntil: "networkidle", timeout: 60000 });

  const launcher = page.locator(".feedl-widget-launcher");
  await launcher.waitFor({ state: "visible", timeout: 10000 });
  const box = await launcher.boundingBox();
  const inViewport =
    box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
  console.log("launcher:", box, "| viewport içinde:", inViewport);

  // Panel aç
  await launcher.click();
  const overlay = page.locator(".feedl-widget-overlay");
  await overlay.waitFor({ state: "visible", timeout: 10000 });
  const panel = await page.locator(".feedl-widget-panel").boundingBox();
  const panelFits = panel && panel.width <= viewport.width && panel.height <= viewport.height;
  console.log("panel:", panel, "| ekrana sığıyor:", panelFits);

  // iframe yüklendi mi + içindeki butonlar
  const frame = page.frameLocator(".feedl-widget-iframe");
  await frame.locator("body").waitFor({ timeout: 15000 });

  const btns = await frame.locator("button").allInnerTexts();
  console.log("iframe butonları:", JSON.stringify(btns));

  const visualBtn = frame.getByRole("button", { name: "Görsel geri bildirim" });
  const visualCount = await visualBtn.count();
  console.log("görsel geri bildirim butonu sayısı:", visualCount);
  if (visualCount > 0) {
    const vb = await visualBtn.boundingBox();
    console.log("görsel buton:", vb);
  }

  // Overlay/pin akışı: butona bas → pin katmanı host sayfada açılmalı
  if (visualCount > 0) {
    await visualBtn.click();
    await page.waitForTimeout(800);
    const vfLayer = page.locator(".feedl-vf-layer");
    const layerCount = await vfLayer.count();
    const layerVisible = layerCount > 0 ? await vfLayer.isVisible() : false;
    const hint = await page.locator(".feedl-vf-hint").count();
    console.log("pin katmanı:", layerCount, "| görünür:", layerVisible, "| ipucu:", hint);

    if (layerVisible) {
      await page.mouse.click(300, 300);
      await page.waitForTimeout(400);
      console.log("pin:", await page.locator(".feedl-vf-pin").count(), "| form:", await page.locator(".feedl-vf-form").count());
      const formInputs = await page.locator(".feedl-vf-form input, .feedl-vf-form textarea").count();
      console.log("form alanları:", formInputs);
    }
  }

  if (errors.length) console.log("--- hatalar ---\n" + errors.slice(0, 10).join("\n"));
  await context.close();
}

await run("MASAÜSTÜ", { width: 1280, height: 800 });
await run("MOBİL", { width: 390, height: 844 });
await run("KÜÇÜK MOBİL", { width: 320, height: 568 });

await browser.close();
