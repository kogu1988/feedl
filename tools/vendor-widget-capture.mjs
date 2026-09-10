#!/usr/bin/env node
// feedl — vendor'lı ekran yakalama kütüphanesini günceller.
//
// Neden: Faz 2 görsel feedback, müşteri sayfasında ekran görüntüsü almak için
// `html-to-image` kullanır. Üçüncü taraf CDN yerine feedl.app'ten servis
// edilir (public/widget-capture.js) → müşteri sitesinde EK CSP izni gerekmez
// ve harici script yüklenmez. Bu betik, kurulu npm sürümünün UMD dist'ini
// lisans başlığıyla birlikte public/ altına kopyalar.
//
// Güncelleme akışı:
//   npm install html-to-image@<sürüm>
//   npm run vendor:capture
//   (doğrula: node --check public/widget-capture.js) → commit.
//
// Not: `docs/standarts.md` "üçüncü taraf kod" kuralı gereği bu dosya
// değiştirilmez; yalnız sürüm yükseltilerek yeniden üretilir.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distFile = resolve(root, "node_modules/html-to-image/dist/html-to-image.js");
const pkgFile = resolve(root, "node_modules/html-to-image/package.json");
const outFile = resolve(root, "public/widget-capture.js");

let version = "?";
try {
  version = JSON.parse(readFileSync(pkgFile, "utf8")).version ?? "?";
} catch {
  console.error("[vendor:capture] html-to-image kurulu değil. Önce: npm i html-to-image");
  process.exit(1);
}

const src = readFileSync(distFile, "utf8");
const header =
  "/*! feedl vendor: html-to-image v" +
  version +
  " (MIT, (c) 2017-2024 David E. King) — https://github.com/bubkoo/html-to-image . " +
  "Served from feedl.app to avoid third-party CSP/script loads. Do not edit; run `npm run vendor:capture` to update. */\n";

writeFileSync(outFile, header + src);
console.log(
  "[vendor:capture] html-to-image v" + version + " → public/widget-capture.js (" + statSync(outFile).size + " bytes)",
);
