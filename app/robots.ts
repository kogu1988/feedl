import type { MetadataRoute } from "next";

// robots.txt — search crawler'lara yön gösterir. Sunucu tarafı path'ler;
// auth/dashboard yüzeyleri indexlenmez (private). Sağlık/api endpoint'leri
// crawler'a gerek yok (sitemap yalnız public sayfaları verir).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
