// Inngest durum raporu: API anahtarı geçerli mi, son olaylar ne, Cloud'da
// KAYITLI FONKSİYONLAR hangileri (audit log üzerinden).
//
// Neden audit log: yönetim REST API'si yalnız `GET /v1/events` sunuyor;
// uygulama/fonksiyon listesi ucu YOK. Fonksiyon kaydı ise Inngest'in kendi
// audit log'unda görünür (her senkronda `inngest/audit-log` +
// `action: "function.updated"`), yani "fonksiyonum panelde görünmüyor"
// sorusunun kesin cevabı buradan çıkar.
//
// Kullanım: node tools/inngest-status.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const key = env.INNGEST_API_KEY;
if (!key) throw new Error("INNGEST_API_KEY yok (.env.local)");
const h = { Authorization: `Bearer ${key}` };

const res = await fetch("https://api.inngest.com/v1/events", { headers: h });
console.log("API anahtarı:", res.ok ? "✅ geçerli" : `❌ ${res.status}`);
if (!res.ok) process.exit(1);

const events = (await res.json()).data ?? [];
console.log(`\nson ${events.length} olay:`);
for (const e of events.slice(0, 10)) {
  console.log(`  ${String(e.received_at).slice(0, 19)}  ${e.name}`);
}

// Audit log → kayıtlı fonksiyonlar.
const audits = events.filter((e) => e.name === "inngest/audit-log");
const registered = new Map();
for (const a of audits) {
  const d = await (await fetch(`https://api.inngest.com/v1/events/${a.internal_id}`, { headers: h })).json();
  const p = d.data?.data ?? {};
  const name = p.resource?.name ?? p.target?.name;
  if (p.action === "function.updated" && name) registered.set(name, p.outcome);
}
if (registered.size > 0) {
  console.log(`\nCloud'da kayıtlı fonksiyonlar (audit log, son senkron):`);
  for (const [name, outcome] of registered) console.log(`  ● ${name}  (${outcome})`);
} else {
  console.log("\naudit log'da fonksiyon kaydı bulunamadı (son 20 olayın dışında olabilir).");
}
