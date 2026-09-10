// Dağıtım sonrası "karışık build" penceresini kanıtlar/çürütür:
// HTML önbellek başlıkları + HTML'in referans verdiği chunk'lar erişilebilir mi?
const BASE = "https://feedl.app";

const html = await fetch(BASE + "/", { headers: { "cache-control": "no-cache" } });
console.log("HTML status:", html.status);
for (const h of ["cache-control", "etag", "x-vercel-cache", "age", "x-nextjs-cache", "x-vercel-id"]) {
  console.log(`  ${h}: ${html.headers.get(h)}`);
}
const body = await html.text();

const re = /\/_next\/static\/[^"'\\\s)]+/g;
const chunks = [...new Set([...body.matchAll(re)].map((m) => m[0]))];
console.log(`\nreferans verilen _next/static yolu: ${chunks.length}`);

let ok = 0;
let bad = 0;
for (const c of chunks) {
  const res = await fetch(BASE + c, { method: "GET" });
  if (!res.ok) {
    bad += 1;
    if (bad <= 5) console.log(`  ❌ ${res.status} ${c}`);
  } else {
    ok += 1;
    if (ok <= 3) console.log(`  ✅ ${res.status} | cache-control: ${res.headers.get("cache-control")} | ${c.slice(0, 60)}`);
  }
}
console.log(`\nsonuc: ${ok} erisilebilir, ${bad} eksik`);
