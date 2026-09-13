// Sprint 71.4 — YÜK PROBU (salt-okunur latency ölçümü).
//
// NEDEN: "10k fikirli bir portal nasıl davranır?" sorusu hiç ölçülmemişti
// (glm_analyse.md §4.6). Bu betik YALNIZ GET uçlarını çağırır — hiçbir veri
// yazmaz, hiçbir kayıt oluşturmaz (üretime karşı güvenle koşulur).
//
// KULLANIM:
//   node tools/load-probe.mjs                                  → feedl.app, 20 eşzamanlı, 5 tur
//   node tools/load-probe.mjs --url=https://feedl.app --concurrency=30 --rounds=10
//   node tools/load-probe.mjs --path=/portal --path=/api/posts
//
// ÇIKTI: yol başına p50 / p95 / maks yanıt süresi ve hata sayısı.

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const BASE = (args.url ?? "https://feedl.app").replace(/\/$/, "");
const CONCURRENCY = Number(args.concurrency ?? 20);
const ROUNDS = Number(args.rounds ?? 5);
const PATHS = args.path
  ? Array.isArray(args.path)
    ? args.path
    : [args.path]
  : ["/", "/portal", "/roadmap", "/api/health"];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function timeOne(path) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-forwarded-host": new URL(BASE).host },
    });
    // Gövdeyi tüket: aksi halde bağlantı kapanmaz ve süre yanıltıcı olur.
    const body = await res.text();
    return { ms: performance.now() - start, ok: res.ok, status: res.status, bytes: body.length };
  } catch (err) {
    return { ms: performance.now() - start, ok: false, status: 0, err: String(err) };
  }
}

async function runPath(path) {
  const samples = [];
  let failures = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const batch = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => timeOne(path)),
    );
    for (const r of batch) {
      samples.push(r.ms);
      if (!r.ok) failures += 1;
    }
  }
  samples.sort((a, b) => a - b);
  return {
    path,
    requests: samples.length,
    failures,
    p50: Math.round(pct(samples, 50)),
    p95: Math.round(pct(samples, 95)),
    max: Math.round(samples[samples.length - 1]),
  };
}

console.log(`Yük probu — ${BASE} · eşzamanlı ${CONCURRENCY} · ${ROUNDS} tur/yol\n`);
const results = [];
for (const path of PATHS) {
  const r = await runPath(path);
  results.push(r);
  console.log(`${r.path.padEnd(14)} ${String(r.requests).padStart(5)} istek · hata ${r.failures} · p50 ${r.p50}ms · p95 ${r.p95}ms · maks ${r.max}ms`);
}
console.log("\nNot: Vercel Hobby cold start'ları p95'i yükseltir; asıl regresyon sinyali p50'dedir.");
