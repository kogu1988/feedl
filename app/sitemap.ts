import type { MetadataRoute } from "next";

// sitemap.xml — yalnız public (indexlenebilir) sayfalar. Portal/roadmap/
// changelog dinamik içerik; sitemap'e statik yollar eklemek yerine bu temel
// public yüzeyler listelenir. Workspace/custom domain bağlamında portal
// `/portal` host'a göre değişir; kök feedl.app için sabit yollar yeterli.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
const NOW = new Date();

const publicPages = [
  "/",
  "/pricing",
  "/demo",
  "/contact",
  "/terms",
  "/privacy",
  "/refund",
  "/changelog",
  "/portal",
  "/roadmap",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: NOW,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
