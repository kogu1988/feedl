// Dağıtılan /api/inngest introspection'ını DOĞRULAYARAK çağır: Inngest Cloud'un
// senkronize ettiği uygulama tanımını (fonksiyon listesi) görürüz.
// Böylece "bizim kod mu, cloud senkronu mu?" ayrımı kesinleşir.
//
// Kullanım:
//   npx vercel env pull .env.vercel.tmp --environment=production --yes
//   node tools/check-inngest-app.mjs
//   rm .env.vercel.tmp        # secret taşır, iş bitince silin
//
// İmza şeması (node_modules/inngest/helpers/net.js):
//   sig = HMAC-SHA256(anahtar_öneksiz, body + timestamp)  — hex
//   header: x-inngest-signature: t=<ts>&s=<sig>
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv(file) {
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {}; // ör. .env.vercel.tmp yoksa (temizlendikten sonra) sessiz geç
  }
  return Object.fromEntries(
    raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

// Üretim değerleri .env.vercel.tmp'de (yerelde SIGNING_KEY boş).
const env = { ...loadEnv(".env.local"), ...loadEnv(".env.vercel.tmp") };

const signingKey = env.INNGEST_SIGNING_KEY;
if (!signingKey) {
  throw new Error(
    "INNGEST_SIGNING_KEY bulunamadi. Uretim degerini cekin:\n" +
      "  npx vercel env pull .env.vercel.tmp --environment=production --yes\n" +
      "sonra bu betigi tekrar calistirin.",
  );
}

const bare = signingKey.replace(/^signkey-[\w]+-/, "");
const ts = Math.floor(Date.now() / 1000).toString();
const body = "";
const sig = createHmac("sha256", bare).update(body).update(ts).digest("hex");

const res = await fetch("https://feedl.app/api/inngest", {
  method: "GET",
  headers: { "x-inngest-signature": `t=${ts}&s=${sig}` },
});
console.log("introspection status:", res.status);
const text = await res.text();
if (res.status !== 200) {
  console.log("yanit:", text.slice(0, 300));
} else {
  // Not: bu uç nokta fonksiyon LİSTESİNİ değil, kayıtlı fonksiyon SAYISINI ve
  // ortam bilgisini döndürür. Yani "bizim dağıtımımız kaç fonksiyon sunuyor?"
  // sorusunu yanıtlar — Inngest Cloud'un senkron durumunu değil.
  const d = JSON.parse(text);
  console.log({
    app_id: d.app_id,
    mode: d.mode,
    env: d.env,
    framework: d.framework,
    sdk_version: d.sdk_version,
    has_signing_key: d.has_signing_key,
    has_event_key: d.has_event_key,
    authentication_succeeded: d.authentication_succeeded,
    function_count: d.function_count,
  });
  // /api/inngest rotasındaki `functions` dizisiyle karşılaştırın:
  // 7 eski fonksiyon + weeklyDigest = 8.
  console.log(`
beklenen (kod): 8 (7 eski + weeklyDigest)`);
  console.log(`sunulan (canli): ${d.function_count} → ${d.function_count === 8 ? "✅ kod canlıda" : "❌ eksik/fazla var"}`);
}
