// Launcher gerçekten GÖRÜNÜR mü? Açık/koyu modda arka plan kontrastını ölçer
// ve sağ-alt köşenin ekran görüntüsünü kaydeder.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();

for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.goto("https://feedl.app/", { waitUntil: "networkidle", timeout: 60000 });

  const info = await page.evaluate(() => {
    const el = document.querySelector(".feedl-widget-launcher");
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    // Launcher'ın arkasındaki gerçek rengi bul: kendi kutusunun altındaki
    // elementi geçici gizleyip o noktada hangi element varsa onu oku.
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const prev = el.style.visibility;
    el.style.visibility = "hidden";
    const behind = document.elementFromPoint(cx, cy);
    const behindBg = behind ? getComputedStyle(behind).backgroundColor : null;
    el.style.visibility = prev;
    return {
      present: true,
      launcherBg: cs.backgroundColor,
      launcherColor: cs.color,
      zIndex: cs.zIndex,
      position: cs.position,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      behindTag: behind ? behind.tagName + "." + behind.className : null,
      behindBg,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y) },
    };
  });
  console.log(`[${scheme}]`, info);

  await page.screenshot({
    path: `tools/shot-${scheme}.png`,
    clip: { x: 940, y: 690, width: 340, height: 110 },
  });
  await context.close();
}

// Service worker var mı (eski betiği önbelleğe alıp almıyor)?
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto("https://feedl.app/", { waitUntil: "networkidle" });
const sw = await p2.evaluate(async () => {
  const regs = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
  return { supported: "serviceWorker" in navigator, count: regs.length };
});
console.log("service worker:", sw);
await ctx2.close();

await browser.close();
