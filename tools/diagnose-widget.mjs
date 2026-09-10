// Canlı sitede widget'ı gerçek tarayıcıda teşhis eder: konsol hataları,
// launcher DOM'da var mı, hangi script çalıştı, baseUrl çözüldü mü.
import { chromium } from "@playwright/test";

const targets = process.argv.slice(2);
const urls = targets.length > 0 ? targets : ["https://feedl.app/"];

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
const errors = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));
page.on("requestfailed", (req) =>
  errors.push(`REQFAIL: ${req.url()} — ${req.failure()?.errorText}`),
);

for (const url of urls) {
  logs.length = 0;
  errors.length = 0;
  console.log("=".repeat(70));
  console.log("URL:", url);

  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  console.log("status:", response?.status());

  // Widget betiği yüklendi mi ve IIFE çalıştı mı?
  const probe = await page.evaluate(() => {
    const launcher = document.querySelector(".feedl-widget-launcher");
    const overlay = document.querySelector(".feedl-widget-overlay");
    const script = document.querySelector('script[src*="widget.js"]');
    const styleTag = Array.from(document.head.querySelectorAll("style")).some((s) =>
      (s.textContent ?? "").includes(".feedl-widget-launcher"),
    );
    return {
      launcherPresent: Boolean(launcher),
      overlayPresent: Boolean(overlay),
      scriptPresent: Boolean(script),
      scriptAsync: script?.hasAttribute("async") ?? null,
      scriptInHead: script ? script.closest("head") !== null : null,
      widgetCssInjected: styleTag,
      loadedFlag: Boolean(window.__feedlWidgetLoaded),
      apiPresent: Boolean(window.feedlWidget),
      bodyExistsAtCheck: Boolean(document.body),
    };
  });
  console.log("probe:", probe);

  if (probe.launcherPresent) {
    const box = await page.locator(".feedl-widget-launcher").boundingBox();
    const visible = await page.locator(".feedl-widget-launcher").isVisible();
    const text = await page.locator(".feedl-widget-launcher").innerText();
    console.log("launcher box:", box, "| visible:", visible, "| text:", JSON.stringify(text));
  } else {
    console.log("LAUNCHER YOK");
  }

  if (errors.length) console.log("--- hatalar ---\n" + errors.join("\n"));
  if (logs.length) console.log("--- konsol ---\n" + logs.slice(0, 25).join("\n"));
}

await browser.close();
