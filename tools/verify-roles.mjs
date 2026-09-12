// 3 kademeli workspace rol matrisini (owner | manager | member) canlıda
// doğrular: owner olarak oturum açar ve şunları kontrol eder:
//   · /dashboard/billing  → 200 (billing OWNER-ONLY; manager göremez)
//   · /dashboard/members  → 200 + rol seçenekleri Sahip/Yönetici/Üye
//     (+ eski "Katkıcı" YOK)
//   · /dashboard          → sidebar'da owner-only "Faturalama" görünür
//
// Kullanım: node tools/verify-roles.mjs [email]
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const app = "https://feedl.app";
const email = process.argv[2] ?? "oguzkir@gmail.com";

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
  console.error("kullanıcı bulunamadı:", email);
  process.exit(1);
}
const tokRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: users[0].id, expires_in_seconds: 600 }),
});
const { token } = await tokRes.json();
if (!token) {
  console.error("sign-in token alınamadı");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto(`${app}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.Clerk && window.Clerk.client, null, { timeout: 30000 });
const signedIn = await page.evaluate(async (ticket) => {
  const res = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket });
  if (res.createdSessionId) await window.Clerk.setActive({ session: res.createdSessionId });
  return Boolean(res.createdSessionId);
}, token);
console.log(`${signedIn ? "✅" : "❌"} oturum: ${email}`);
await page.waitForTimeout(1200);

async function checkHtml(path, mustHave = [], mustNotHave = []) {
  const res = await page.request.get(`${app}${path}`);
  const body = res.status() === 200 ? await res.text() : "";
  const missing = mustHave.filter((s) => !body.includes(s));
  const present = mustNotHave.filter((s) => body.includes(s));
  const ok = res.status() === 200 && missing.length === 0 && present.length === 0;
  console.log(
    `${ok ? "✅" : "❌"} ${path} → ${res.status()}` +
      (missing.length ? ` · eksik: ${missing.join(", ")}` : "") +
      (present.length ? ` · olmamalıydı: ${present.join(", ")}` : ""),
  );
  return ok;
}

const okBilling = await checkHtml("/dashboard/billing", ["Faturalandırma"]);
const okMembers = await checkHtml(
  "/dashboard/members",
  ["Sahip", "Yönetici", "Üye"],
  ["Katkıcı"],
);
const okSidebar = await checkHtml("/dashboard", ["Faturalama"]);

console.log(
  `\n${okBilling && okMembers && okSidebar ? "✅ rol matrisi canlıda doğru" : "❌ rol doğrulaması başarısız"}`,
);

await context.close();
await browser.close();
process.exit(okBilling && okMembers && okSidebar ? 0 : 1);
