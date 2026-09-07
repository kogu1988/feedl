import type { NextRequest } from "next/server";

// robots.txt — explicit route handler (metadata route yerine; Vercel'de
// Turbopack + App Router kombinasyonunda `/robots.txt` metadata route'u her
// kurulumda servis edilmeyebiliyor — normal route handler kesin çalışır).
// Host istekten türetilir (custom domain / subdomain için doğru sitemap URL'si).
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
