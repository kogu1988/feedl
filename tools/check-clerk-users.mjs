// Clerk Backend API: aynı e-postalı kimliklerden hangisi GERÇEKTEN kullanılıyor?
// (last_sign_in_at / last_active_at kesin kanıt.) Secret stdout'a basılmaz.
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

const h = { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` };

const listRes = await fetch(
  "https://api.clerk.com/v1/users?email_address=" + encodeURIComponent("oguzkir@gmail.com") + "&limit=20",
  { headers: h },
);
console.log("liste status:", listRes.status);
const users = await listRes.json();

if (!Array.isArray(users)) {
  console.log("HAM:", JSON.stringify(users).slice(0, 400));
} else {
  console.log(`aynı e-postalı ${users.length} Clerk kullanıcısı:\n`);
  for (const u of users) {
    const primary = u.email_addresses?.find((e) => e.id === u.primary_email_address_id);
    console.log({
      id: u.id,
      email: primary?.email_address,
      verification: primary?.verification?.status,
      created_at: u.created_at ? new Date(u.created_at).toISOString() : null,
      updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : null,
      last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
      last_active_at: u.last_active_at ? new Date(u.last_active_at).toISOString() : null,
      banned: u.banned,
      password_enabled: u.password_enabled,
      external_accounts: (u.external_accounts ?? []).map((a) => a.provider),
    });
  }
}
