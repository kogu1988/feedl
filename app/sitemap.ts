import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// sitemap.xml — metadata route. Yalnız public (indexlenebilir) sayfalar;
// host, isteğin Host başlığından türetilir (custom domain / subdomain).
const NOW = new Date();

const publicPages: Array<{ path: string; priority: number; freq: "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/pricing", priority: 0.8, freq: "monthly" },
  { path: "/demo", priority: 0.8, freq: "monthly" },
  { path: "/changelog", priority: 0.7, freq: "weekly" },
  { path: "/portal", priority: 0.7, freq: "weekly" },
  { path: "/roadmap", priority: 0.6, freq: "weekly" },
  { path: "/contact", priority: 0.5, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/refund", priority: 0.3, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "feedl.app";
  const base = `https://${host}`;

  return publicPages.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: NOW,
    changeFrequency: page.freq,
    priority: page.priority,
  }));
}
