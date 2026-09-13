import type { NextRequest } from "next/server";

import { resolveWorkspaceForHostname } from "@/lib/db/workspace";

// sitemap.xml — explicit route handler (Vercel rezerve path; `public/` çalışmaz).
// Yalnız public (indexlenebilir) sayfalar; host istekten türetilir.
const PUBLIC_PAGES: Array<{ path: string; priority: string; freq: string }> = [
  { path: "/", priority: "1.0", freq: "weekly" },
  { path: "/demo", priority: "0.8", freq: "monthly" },
  { path: "/alternative", priority: "0.7", freq: "monthly" },
  { path: "/how-to-collect-feedback", priority: "0.7", freq: "monthly" },
  { path: "/changelog", priority: "0.7", freq: "weekly" },
  { path: "/portal", priority: "0.7", freq: "weekly" },
  { path: "/roadmap", priority: "0.6", freq: "weekly" },
  { path: "/contact", priority: "0.5", freq: "yearly" },
  { path: "/terms", priority: "0.3", freq: "yearly" },
  { path: "/privacy", priority: "0.3", freq: "yearly" },
  { path: "/refund", priority: "0.3", freq: "yearly" },
];

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "feedl.app";

  // 2026-09-12 (fail-closed): bilinmeyen host kendi URL'lerini sitemap'te
  // duyurmaz — boş urlset döner (200, geçerli XML). Kök host ve *.vercel.app
  // preview'ları normal listeyi alır.
  let workspace: Awaited<ReturnType<typeof resolveWorkspaceForHostname>> = null;
  try {
    workspace = await resolveWorkspaceForHostname(host);
  } catch {
    workspace = null;
  }

  const base = `https://${host}`;
  const urls = workspace
    ? PUBLIC_PAGES.map(
        (page) =>
          `  <url><loc>${base}${page.path}</loc><changefreq>${page.freq}</changefreq><priority>${page.priority}</priority></url>`,
      ).join("\n")
    : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": workspace ? "all" : "noindex",
    },
  });
}
