import type { NextRequest } from "next/server";

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
Disallow: /api/

Sitemap: https://${host}/sitemap.xml
`;

export function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "feedl.app";
  return new Response(ROBOTS(host), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
