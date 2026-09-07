import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// robots.txt — metadata route (Next.js App Router). Public sayfalar indexlenir;
// admin/auth/private yüzeyler disallow edilir. host, isteğin Host başlığından
// türetilir (custom domain / subdomain için doğru canonical sitemap URL'si).

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "feedl.app";
  const base = `https://${host}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/onboarding",
          "/invites",
          "/sign-in",
          "/sign-up",
          "/widget",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
