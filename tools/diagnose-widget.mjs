// Canlıda widget'ı gerçek tarayıcıda uçtan uca teşhis eder:
//  1) launcher DOM'da mı, görünür mü, arka planı sayfa zeminiyle KONTRASTLI mı
//  2) panel açılıyor mu, ekrana sığıyor mu
//  3) iframe yükleniyor mu, "Görsel geri bildirim" butonu var mı
//  4) pin katmanı + form açılıyor mu
// Açık ve koyu tema, masaüstü ve mobil viewport.
//
// Kullanım: node tools/diagnose-widget.mjs [url]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://feedl.app/";

// WCAG göreli parlaklık + kontrast oranı (launcher zemini vs sayfa zemini).
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const browser = await chromium.launch();
const scenarios = [
  { label: "MASAÜSTÜ AÇIK", scheme: "light", viewport: { width: 1280, height: 800 } },
  { label: "MASAÜSTÜ KOYU", scheme: "dark", viewport: { width: 1280, height: 800 } },
  { label: "MOBİL KOYU", scheme: "dark", viewport: { width: 390, height: 844 } },
  { label: "KÜÇÜK MOBİL", scheme: "light", viewport: { width: 320, height: 568 } },
];

for (const { label, scheme, viewport } of scenarios) {
  const context = await browser.newContext({ viewport, colorScheme: scheme });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
  });

  console.log("=".repeat(72));
  console.log(`${label} — ${viewport.width}x${viewport.height}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const launcher = page.locator(".feedl-widget-launcher");
  try {
    await launcher.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    console.log("❌ LAUNCHER GÖRÜNMÜYOR");
    if (errors.length) console.log(errors.join("\n"));
    await context.close();
    continue;
  }

  const info = await page.evaluate(() => {
    const el = document.querySelector(".feedl-widget-launcher");
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const prev = el.style.visibility;
    el.style.visibility = "hidden";
    const behind = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    el.style.visibility = prev;
    // Launcher'ın arkasındaki zinciri yürüyüp ilk opak zemini bul.
    let node = behind;
    let bg = null;
    while (node && node !== document.documentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
        bg = c;
        break;
      }
      node = node.parentElement;
    }
    if (!bg) bg = getComputedStyle(document.body).backgroundColor;

    // Hesaplanan renk `lab(...)` gelebilir (modern Chrome); güvenilir RGB için
    // rengi bir canvas'a boyayıp pikselini oku.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    function toRgb(color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    }

    return {
      launcherBg: cs.backgroundColor,
      launcherRgb: toRgb(cs.backgroundColor),
      launcherColor: cs.color,
      behindBg: bg,
      behindRgb: toRgb(bg),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    };
  });

  const ratio = contrast(info.launcherRgb, info.behindRgb);
  const ok = ratio >= 3;
  console.log(
    `${ok ? "✅" : "⚠️ "} launcher ${info.rect.w}x${info.rect.h} @ ${info.rect.x},${info.rect.y} | ` +
      `renk ${info.launcherBg} / zemin ${info.behindBg} | kontrast ${ratio.toFixed(2)}:1 (WCAG UI min 3:1)`,
  );

  await launcher.click();
  const panel = await page.locator(".feedl-widget-panel").boundingBox();
  const fits = panel && panel.width <= viewport.width + 1 && panel.height <= viewport.height + 1;
  console.log(`${fits ? "✅" : "⚠️ "} panel ${Math.round(panel?.width ?? 0)}x${Math.round(panel?.height ?? 0)} — ekrana sığıyor: ${fits}`);

  const frame = page.frameLocator(".feedl-widget-iframe");
  await frame.locator("body").waitFor({ timeout: 15000 });
  const buttons = await frame.locator("button").allInnerTexts();
  const hasVisual = buttons.some((b) => b.includes("Görsel"));
  console.log(`${hasVisual ? "✅" : "❌"} iframe butonları: ${JSON.stringify(buttons.slice(0, 3))}`);

  if (hasVisual) {
    await frame.getByRole("button", { name: "Görsel geri bildirim" }).click();
    await page.waitForTimeout(700);
    const layerVisible = await page.locator(".feedl-vf-layer").isVisible();
    console.log(`${layerVisible ? "✅" : "❌"} pin katmanı açıldı: ${layerVisible}`);
    if (layerVisible) {
      await page.mouse.click(300, 300);
      await page.waitForTimeout(400);
      const fields = await page.locator(".feedl-vf-form input, .feedl-vf-form textarea").count();
      console.log(`${fields === 2 ? "✅" : "❌"} pin + form alanları: ${fields}`);
    }
  }

  if (errors.length) console.log("hatalar:\n" + errors.slice(0, 6).join("\n"));
  await context.close();
}

await browser.close();
