// Inngest Cloud senkronunu TETİKLER (out-of-band sync).
//
// NEDEN GEREKLİ: Inngest Cloud, uygulamanızın tanımını senkron anında çekip
// saklar. Yeni bir fonksiyon ekleyip deploy etmek bu anlık görüntüyü tek başına
// güncellemez → fonksiyon panelde görünmez. Bu betik senkronu elle tetikler.
//
// NASIL ÇALIŞIR: Inngest SDK, `PUT /api/inngest` isteğini aldığında (in-band
// sync kapalıyken) `POST https://api.inngest.com/fn/register` çağrısı yapıp
// uygulama tanımını Cloud'a kaydeder. Bu betik o PUT'u Inngest Cloud'un
// yaptığı gibi İMZALAYARAK gönderir; kaydı SDK kendisi yapar.
//
// İmza şeması (node_modules/inngest/helpers/net.js):
//   sig = HMAC-SHA256(anahtar_öneksiz, body + timestamp)  — hex
//   header: x-inngest-signature: t=<ts>&s=<sig>
//
// Kullanım:
//   npx vercel env pull .env.vercel.tmp --environment=production --yes
//   node tools/sync-inngest.mjs
//   rm .env.vercel.tmp        # secret taşır, iş bitince silin
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv(file) {
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.vercel.tmp") };
const signingKey = env.INNGEST_SIGNING_KEY;
if (!signingKey) {
  throw new Error(
    "INNGEST_SIGNING_KEY yok. Üretim değerini çekin:\n" +
      "  npx vercel env pull .env.vercel.tmp --environment=production --yes",
  );
}

const ts = Math.floor(Date.now() / 1000).toString();
const sig = createHmac("sha256", signingKey.replace(/^signkey-[\w]+-/, ""))
  .update("")
  .update(ts)
  .digest("hex");

const res = await fetch("https://feedl.app/api/inngest", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "x-inngest-signature": `t=${ts}&s=${sig}`,
  },
});
const text = await res.text();
console.log("sync status:", res.status, text);

// Beklenen: 200 {"message":"Successfully registered","modified":true}
// 401 → Inngest panosundaki signing key bu dağıtımla uyuşmuyor.
if (res.status === 401) {
  console.log("\n401: Inngest panosundaki signing key, Vercel'in üretim");
  console.log("INNGEST_SIGNING_KEY değeriyle aynı olmalı.");
} else if (res.status === 200) {
  console.log("\n✅ Senkron gönderildi. Inngest panosunda Apps → feedl →");
  console.log("   Functions listesinde weekly-digest görünmeli (cron: 0 6 * * 1).");
}
