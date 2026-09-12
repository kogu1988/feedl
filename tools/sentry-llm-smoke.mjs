// Sentry'ye "LLM hattı öldü" olayını TEMSİLİ olarak gönderir; amaç, mevcut
// "Send a notification for high priority issues" kuralının (807520) bu olayı
// yakalayıp yakalamadığını ÖLÇMEK — yani LLM arızasında e-posta bildirimi
// alabilmek için ayrı bir kural şart mı, yoksa level=fatal yeterli mi?
//
// Neden gerekli: Sentry MCP'sinde alert kuralı OLUŞTURAN araç yok ve
// SENTRY_AUTH_TOKEN yalnız source-map yetkili (403). Bu betik, Sentry'nin
// öncelik (priority) hesabını üretime dokunmadan doğrular.
//
// Kullanım:
//   node tools/sentry-llm-smoke.mjs                 # level=fatal (varsayılan)
//   node tools/sentry-llm-smoke.mjs --level=error   # karşılaştırma için
//   node tools/sentry-llm-smoke.mjs --tagged-only   # yalnız alan etiketi (kural testi)
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

function parseDotenv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

const argv = process.argv.slice(2);
const levelArg = argv.find((a) => a.startsWith("--level="));
const level = levelArg ? levelArg.split("=")[1] : "fatal";
const taggedOnly = argv.includes("--tagged-only");

let dsn = process.env.SENTRY_DSN;
if (!dsn && existsSync(".env.local")) {
  dsn = parseDotenv(readFileSync(".env.local", "utf8")).SENTRY_DSN;
}
if (!dsn) {
  console.error("SENTRY_DSN yok (.env.local veya ortam değişkeni).");
  process.exit(1);
}

const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(\d+)$/);
if (!match) {
  console.error("SENTRY_DSN beklenen biçimde değil ( https://KEY@HOST/PROJECT ).");
  process.exit(1);
}
const [, publicKey, host, projectId] = match;

const event = {
  event_id: randomUUID().replace(/-/g, ""),
  timestamp: new Date().toISOString(),
  platform: "node",
  level,
  environment: "production",
  logger: "feedl.llm",
  message: taggedOnly
    ? "LLM smoke (tagged only)"
    : "LLM model chain exhausted (smoke)",
  // Seviye başına ayrı issue: "yeni issue" koşulu öncelik hesabını etkilediği
  // için fatal ve error provaları aynı fingerprint'e düşmemeli.
  fingerprint: [`llm-smoke-probe-${level}`],
  tags: {
    area: "llm",
    scope: "chat-json",
    probe: "priority",
    // Smoke olayları üretim issue'larıyla karışmasın diye ayırt edici etiket.
    source: "sentry-llm-smoke",
  },
  extra: {
    models: ["amazon/nova-micro-v1", "mistralai/mistral-nemo"],
  },
};

const url = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(event),
});
const body = await res.text();

console.log(`level=${level} → HTTP ${res.status}`);
// DSN public anahtarı gizli değildir ama yine de yalnız olay kimliğini yaz.
try {
  const parsed = JSON.parse(body);
  console.log(`event id: ${parsed.id ?? "?"}`);
} catch {
  console.log(body.slice(0, 200));
}
if (!res.ok) process.exit(1);
console.log(
  "\nŞimdi Sentry'de kontrol et:\n" +
    "  · issue.priority:high  → search_issues(area:llm source:sentry-llm-smoke)\n" +
    "  · kural 807520 lastTriggered → find_alert_rules (issue)\n" +
    "Öncelik/akış hesaplaması birkaç dakika gecikebilir.",
);
