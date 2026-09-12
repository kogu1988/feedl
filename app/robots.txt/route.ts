import type { NextRequest } from "next/server";

import { resolveWorkspaceForHostname } from "@/lib/db/workspace";

// robots.txt — explicit route handler. Vercel, `/robots.txt` ve `/sitemap.xml`'i
// rezerve path olarak ele alıp `public/`'ten servis ETMEZ; bu yüzden App Router
// route handler kesin çözümdür (statik dosya 404'lüyor). Host istekten türetilir.
const ROBOTS = (host: string) => `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /onboarding
Disallow: /invites
Disallow: /sign-in
Disallow: /sign-up
Disallow: /widget
Disallow: /survey
Disallow: /api/

Sitemap: https://${host}/sitemap.xml
`;

// 2026-09-12 (fail-closed): host bilinen bir workspace'e çözülmüyorsa
// (var olmayan alt alan / doğrulanmamış custom domain) taramanın tamamı
// kapatılır ve sitemap satırı YAZILMAZ — bilinmeyen bir host kendini
// indeksletmeye davet etmemeli. Kök host ve *.vercel.app preview'ları normal
// davranışı korur (bkz. lib/db/workspace.ts → isDefaultFallbackHost).
const UNKNOWN_HOST_ROBOTS = `User-agent: *
Disallow: /
`;

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "feedl.app";

  let workspace: Awaited<ReturnType<typeof resolveWorkspaceForHostname>> = null;
  try {
    workspace = await resolveWorkspaceForHostname(host);
  } catch {
    // DB erişilemezse robots'u 500 yapmayalım — güvenli tarafa (kapalı) düş.
    workspace = null;
  }

  return new Response(workspace ? ROBOTS(host) : UNKNOWN_HOST_ROBOTS, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": workspace ? "all" : "noindex",
    },
  });
}
