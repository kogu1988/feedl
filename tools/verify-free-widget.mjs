// FREE plan widget görünümünü doğrular: geçici bir free workspace aç,
// /widget?ws=<slug> HTML'inde "Powered by" rozeti var mı bak, sonra SİL.
// (Canlıdaki tek workspace Pro olduğu için free dalı başka türlü görülemez.)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

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

const sql = neon(env.DATABASE_URL);
const SLUG = "zz-free-verify";

async function cleanup() {
  await sql`delete from workspaces where slug = ${SLUG}`;
}

try {
  await cleanup(); // kalıntı varsa temizle
  await sql`insert into workspaces (name, slug, plan) values ('Free Verify', ${SLUG}, 'free')`;
  console.log("geçici free workspace açıldı:", SLUG);

  const res = await fetch(`https://feedl.app/widget?ws=${SLUG}`);
  const html = await res.text();
  console.log("widget status:", res.status, "| uzunluk:", html.length);

  const checks = {
    "rozet (Powered by)": html.includes("Powered by"),
    "feedl linki": html.includes("https://feedl.app"),
    "marka logosu": html.includes("logo_brand_orange.svg"),
    "panel render oldu (Fikir gönder)": html.includes("Fikir gönder"),
  };
  for (const [k, v] of Object.entries(checks)) console.log(` ${v ? "✅" : "❌"} ${k}`);

  // Karşılaştırma: PRO workspace'te rozet OLMAMALI.
  const proRes = await fetch("https://feedl.app/widget?ws=feedl");
  const proHtml = await proRes.text();
  console.log(
    `\nkarşılaştırma — feedl (pro) rozeti gizli mi: ${!proHtml.includes("Powered by") ? "✅ evet" : "❌ hayır"}`,
  );
} finally {
  await cleanup();
  const left = await sql`select count(*)::int n from workspaces where slug = ${SLUG}`;
  console.log("temizlik — kalan geçici workspace:", left[0].n);
}
