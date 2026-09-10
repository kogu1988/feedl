// Hidrasyon/launcher yarışını YAKALAMAK için zengin durum dökümü.
//
// Neden: gözlenen hata (React #418 → launcher yok) yalnız soğuk/deploy sonrası
// durumda ve seyrek çıkıyor. Bu betik hatayı yakaladığında sebebi ayırt eder:
//   · script yüklendi mi? (network fail / adblock)
//   · widget script çalıştı mı? (window.__feedlWidgetLoaded)
//   · düğüm DOM'da var mı ama gizli mi, yoksa hiç yok mu?
//   · body'nin çocukları React tarafından yeniden mi yazıldı?
//   · hangi istekler başarısız oldu?
//
// Kullanım: node tools/probe-hydration.mjs [yukleme_sayisi]
// ÖNERİ: her deploy'dan hemen sonra çalıştırın (hata o pencerede çıkıyor).
import { chromium } from "@playwright/test";

const RUNS = Number(process.argv[2] ?? 8);
const URL = "https://feedl.app/";

const browser = await chromium.launch();
let failures = 0;

for (let i = 0; i < RUNS; i++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(-70)} — ${r.failure()?.errorText}`));

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const launcher = document.querySelector(".feedl-widget-launcher");
    const overlay = document.querySelector(".feedl-widget-overlay");
    const script = document.querySelector('script[src*="widget.js"]');
    return {
      launcherPresent: Boolean(launcher),
      launcherVisible: launcher ? getComputedStyle(launcher).display !== "none" : false,
      overlayPresent: Boolean(overlay),
      scriptTagPresent: Boolean(script),
      scriptInHead: script ? script.closest("head") !== null : null,
      widgetFlag: Boolean(window.__feedlWidgetLoaded),
      // body'de React'in yazdığı ilk çocuklar — React yeniden render ettiyse
      // burada olağan dışı bir şey görünür.
      bodyChildTags: [...document.body.children].slice(0, 8).map(
        (el) => el.tagName + (el.className ? "." + String(el.className).split(" ")[0] : ""),
      ),
    };
  });

  const hydrationError = errors.find((e) => e.includes("418") || e.includes("Hydration"));
  const broken = !state.launcherPresent || Boolean(hydrationError);

  if (!broken) {
    console.log(`#${i + 1} ✅ launcher var | script=${state.scriptTagPresent} flag=${state.widgetFlag}`);
  } else {
    failures += 1;
    console.log(`#${i + 1} ❌ SORUN YAKALANDI`);
    console.log("   durum:", state);
    if (hydrationError) console.log("   hidrasyon:", hydrationError.slice(0, 140));
    for (const e of errors.slice(0, 5)) console.log("   hata:", e.slice(0, 140));
    for (const f of failedRequests.slice(0, 8)) console.log("   istek başarısız:", f);
  }
  await context.close();
}

console.log(`\n${RUNS} yüklemede ${failures} sorun`);
await browser.close();
