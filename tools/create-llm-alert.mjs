// Sentry'de "LLM pipeline failure" issue alert'ini oluşturur (idempotent: aynı
// isimde kural varsa dokunmaz). Token ve değerler stdout'a YAZILMAZ.
//
// NEDEN BU KURAL VAR (2026-09-12 ölçümü):
//   • Sentry MCP'sinde alert kuralı OLUŞTURAN araç yok (yalnız find/get, ikisi
//     de read-only) ve Vercel'deki SENTRY_AUTH_TOKEN yalnızca source-map
//     yetkili → POST /rules/ 403 döner.
//   • Canlı ölçüm: `level=error` VEYA `fatal` ile gelen YENİ bir issue
//     `issue.priority:high` olur → mevcut "Send a notification for high
//     priority issues" kuralı (807520) zaten e-posta atar. Provalar FEEDL-2 ve
//     FEEDL-3 olarak oluştu; 807520'nin lastTriggered'ı aynı saniyeye güncellendi.
//   • Yani YENİ LLM arızasında kör değiliz. Bu kuralın eklediği değer:
//     (a) `area:llm` kapsaması açık ve aranabilir biçimde belgelenir,
//     (b) generic kural devre dışı bırakılsa/edilse bile LLM uyarısı sürer,
//     (c) önceliği düşmüş (yeni olmayan) tekrarlayan LLM arızaları da
//     yakalanır — bu yüzden koşul "An event is seen", "New issue" değil.
//
// Token kaynağı (sırayla):
//   1) .env.local içinde SENTRY_API_TOKEN  ← önerilen: Settings → Auth Tokens,
//      scope: alerts:write (veya project:write)
//   2) Vercel Production SENTRY_AUTH_TOKEN  ← yalnız source-map yetkisi var,
//      alerts:write YOK (403 verir), yani bu yolla oluşturulamaz
//
// Kullanım:
//   node tools/create-llm-alert.mjs           (yetki testi + plan)
//   node tools/create-llm-alert.mjs --apply
import { readFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const ORG = "kogu";
const PROJECT = "feedl";

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

let token = process.env.SENTRY_API_TOKEN;
let source = "ortam değişkeni SENTRY_API_TOKEN";
if (!token && existsSync(".env.local")) {
  const local = parseDotenv(readFileSync(".env.local", "utf8"));
  if (local.SENTRY_API_TOKEN) {
    token = local.SENTRY_API_TOKEN;
    source = ".env.local SENTRY_API_TOKEN";
  }
}
if (!token) {
  const tmp = "tools/.env.prod.tmp";
  try {
    execFileSync("vercel", ["env", "pull", tmp, "--environment=production", "--yes"], {
      stdio: "pipe",
      shell: true,
    });
    const pulled = parseDotenv(readFileSync(tmp, "utf8"));
    if (pulled.SENTRY_AUTH_TOKEN && pulled.SENTRY_AUTH_TOKEN !== "[SENSITIVE]") {
      token = pulled.SENTRY_AUTH_TOKEN;
      source = "Vercel SENTRY_AUTH_TOKEN (source-map token)";
    }
  } catch {
    /* aşağıda hata verir */
  } finally {
    rmSync(tmp, { force: true });
  }
}
if (!token) {
  console.error("Token yok. .env.local içine SENTRY_API_TOKEN ekle (scope: alerts:write).");
  process.exit(1);
}
console.log(`token kaynağı: ${source}`);

const RULE = {
  name: "LLM pipeline failure",
  actionMatch: "any",
  filterMatch: "all",
  // Aynı issue için en fazla 30 dakikada bir bildirim (Inngest retry fırtınası
  // ve toplu arıza sırasında e-posta bombardımanını önler).
  frequency: 30,
  environment: "production",
  conditions: [
    // "An event is seen" — yalnız ilk olayı değil, önceliği düşmüş tekrarları da yakalar.
    { id: "sentry.rules.conditions.every_event.EveryEventCondition" },
  ],
  filters: [
    {
      id: "sentry.rules.filters.tagged_event.TaggedEventFilter",
      key: "area",
      match: "eq",
      value: "llm",
    },
  ],
  actions: [
    {
      id: "sentry.mail.actions.NotifyEmailAction",
      targetType: "IssueOwners",
      fallthroughType: "ActiveMembers",
    },
  ],
};

const hosts = ["https://kogu.sentry.io", "https://de.sentry.io"];
let base = null;
for (const host of hosts) {
  const res = await fetch(`${host}/api/0/projects/${ORG}/${PROJECT}/rules/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const rules = await res.json();
    console.log(`✅ okuma yetkisi var (${host}) — mevcut kural: ${rules.length}`);
    for (const r of rules) console.log(`   · [${r.id}] ${r.name}`);
    if (rules.some((r) => r.name === RULE.name)) {
      console.log(`\nℹ️  "${RULE.name}" kuralı ZATEN VAR — dokunmuyorum.`);
      process.exit(0);
    }
    base = host;
    break;
  }
  console.log(`✗ ${host} → ${res.status} ${(await res.text()).slice(0, 120)}`);
}
if (!base) {
  console.error(
    "\nYazma/okuma yetkisi yok — token `alerts:write` (veya project:write) içermeli.\n" +
      "Alternatif (UI, ~1 dk): https://kogu.sentry.io/alerts/rules/feedl/\n" +
      "  Create Alert → Issues → name: LLM pipeline failure →\n" +
      "  filter: area equals llm → condition: An event is seen →\n" +
      "  action: email → environment: production → throttle 30 min.",
  );
  process.exit(1);
}

console.log("\noluşturulacak kural:");
console.log(JSON.stringify(RULE, null, 2));
if (!apply) {
  console.log("\n(kuru çalıştırma — oluşturmak için --apply)");
  process.exit(0);
}

const res = await fetch(`${base}/api/0/projects/${ORG}/${PROJECT}/rules/`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(RULE),
});
const body = await res.text();
if (!res.ok) {
  console.error(`\n❌ oluşturulamadı: ${res.status} ${body.slice(0, 400)}`);
  process.exit(1);
}
const created = JSON.parse(body);
console.log(`\n✅ oluşturuldu: [${created.id}] ${created.name}`);
console.log(`   ${base}/organizations/${ORG}/alerts/rules/${PROJECT}/${created.id}/`);
