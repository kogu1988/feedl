// Mekanizma kanıtı: widget, React hidrasyonundan ÖNCE bağlanırsa ne olur?
//
// Yöntem: Next.js JS chunk'larını yapay olarak geciktir (hidrasyon gecikir),
// widget.js'i geciktirme (anında bağlanır). Sonra bak:
//   · hidrasyon hatası (#418) çıkıyor mu?
//   · launcher kayboluyor mu?
// Hipotez: React, <body>'yi sahiplendiği için beklenmeyen ek çocuğu görüp
// uyuşmazlık hatası verir ve body'yi yeniden render ederek launcher'ı siler.
import { chromium } from "@playwright/test";

const DELAY_MS = Number(process.argv[2] ?? 4000);
const browser = await chromium.launch();

async function run({ delayChunks }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];

  if (delayChunks) {
    // Yalnız uygulama chunk'larını geciktir; /widget.js ve CSS serbest kalsın.
    await page.route("**/_next/static/**", async (route) => {
      await new Promise((r) => setTimeout(r, DELAY_MS));
      await route.continue();
    });
  }

  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("https://feedl.app/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    launcher: Boolean(document.querySelector(".feedl-widget-launcher")),
    flag: Boolean(window.__feedlWidgetLoaded),
  }));
  const hydration = errors.filter((e) => e.includes("418") || e.includes("Hydration"));

  console.log(
    `${delayChunks ? `chunk gecikmesi ${DELAY_MS}ms` : "gecikmesiz (kontrol)"} → ` +
      `launcher: ${state.launcher ? "VAR" : "YOK"} | script.calisti=${state.flag} | hidrasyon hatasi: ${hydration.length}`,
  );
  if (hydration.length) console.log("   ", hydration[0].slice(0, 150));

  await context.close();
  return { launcher: state.launcher, hydration: hydration.length };
}

const control = await run({ delayChunks: false });
const delayed = await run({ delayChunks: true });

console.log("\n--- sonuc ---");
console.log("kontrol:", control);
console.log("gecikmeli:", delayed);
// Bu betik bir DOĞRULAMA aracıdır: chunk'ları geciktirip widget'ı hidrasyondan
// önce bağlanmaya zorlar. Hata çıkarsa düzeltme YOK/bozuk; çıkmazsa düzeltme
// tutuyor demektir.
if (delayed.hydration > 0 || !delayed.launcher) {
  console.log(
    "\n⚠️ YARIS YENIDEN URETILDI — widget hidrasyondan once baglaniyor ve React onu siliyor.",
  );
  console.log("   (Duzeltme kaldirilmissa ya da bozulmussa beklenen sonuc budur.)");
  process.exitCode = 1;
} else {
  console.log(
    "\n✅ Yarisa girilmiyor: gecikmeli durumda da launcher VAR ve hidrasyon hatasi YOK.",
  );
}

await browser.close();
