// Görsel feedback ekran görüntüsünün ADMIN oturumuyla gerçekten aktığını
// doğrular: Clerk sign-in token ile owner olarak oturum açar, private-Blob
// proxy'sini (/api/visual-feedback/image) sayfa içinden çeker ve portal detay
// sayfasında <img>'in gerçekten boyutlandığını (naturalWidth > 0) kontrol eder.
//
// Kullanım: node tools/verify-visual-image.mjs <postId> [email]
// Prod Clerk instance'ında test kullanıcıları yok; sign-in token kullanılır.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const app = "https://feedl.app";
const postId = process.argv[2];
const email = process.argv[3] ?? "oguzkir@gmail.com";
if (!postId) {
  console.error("kullanım: node tools/verify-visual-image.mjs <postId> [email]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const headers = {
  Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

const usersRes = await fetch(
  `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
  { headers },
);
const users = await usersRes.json();
if (!Array.isArray(users) || users.length === 0) {
  console.error("kullanıcı bulunamadı:", JSON.stringify(users).slice(0, 200));
  process.exit(1);
}
const userId = users[0].id;
console.log("✅ kullanıcı:", userId, "(sign-in token oluşturuluyor)");

const tokRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
});
const tokJson = await tokRes.json();
if (!tokJson.token) {
  console.error("sign-in token alınamadı:", JSON.stringify(tokJson).slice(0, 200));
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(`${app}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.Clerk && window.Clerk.client, null, {
  timeout: 30000,
});

const signIn = await page.evaluate(async (ticket) => {
  const res = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket });
  if (res.createdSessionId) await window.Clerk.setActive({ session: res.createdSessionId });
  return { status: res.status, hasSession: Boolean(res.createdSessionId) };
}, tokJson.token);
console.log(`${signIn.hasSession ? "✅" : "❌"} oturum açıldı (status=${signIn.status})`);

await page.waitForTimeout(1500);

// 1) Proxy'i oturumlu sayfadan çek.
const proxied = await page.evaluate(async (id) => {
  const res = await fetch(`/api/visual-feedback/image?postId=${id}`);
  const buf = await res.arrayBuffer();
  return {
    status: res.status,
    ct: res.headers.get("content-type") || "",
    bytes: buf.byteLength,
  };
}, postId);
const proxyOk = proxied.status === 200 && proxied.ct.startsWith("image/") && proxied.bytes > 0;
console.log(
  `${proxyOk ? "✅" : "❌"} private-blob proxy: ${proxied.status} ${proxied.ct} ${proxied.bytes} bayt`,
);

// 2) Portal detay sayfasında görsel gerçekten render oluyor mu?
await page.goto(`${app}/portal/${postId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const img = await page.evaluate(() => {
  const el = document.querySelector('img[src^="/api/visual-feedback/image"]');
  if (!el) return null;
  return { naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, complete: el.complete };
});
if (!img) {
  console.log("❌ portal detayında görsel <img> bulunamadı (isAdmin guard'ı veya kayıt yok)");
} else {
  const rendered = img.naturalWidth > 0;
  console.log(
    `${rendered ? "✅" : "❌"} portal <img> render: naturalWidth=${img.naturalWidth} naturalHeight=${img.naturalHeight}`,
  );
}

if (errors.length) console.log("hatalar:\n" + errors.slice(0, 6).join("\n"));
await context.close();
await browser.close();
