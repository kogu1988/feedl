import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

// SEO-regresyon: sitemap.xml ve robots.txt App Router route handler'ları.
// Bunlar SEO için kritik (crawl + indexability) ve yeni SEO sayfaları
// (alternative / how-to-collect-feedback) sitemap'e alınmalı;
// robots, indexlenmemesi gereken yüzeyleri (auth/api/widget) disallow eder.
import { GET as sitemapGET } from "@/app/sitemap.xml/route";
import { GET as robotsGET } from "@/app/robots.txt/route";

function req(path: string, host = "feedl.app"): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: { "x-forwarded-host": host },
  });
}

describe("sitemap.xml", () => {
  it("returns XML with the public pages incl. SEO pages", async () => {
    const res = await sitemapGET(req("/sitemap.xml"));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("https://feedl.app/");
    expect(xml).toContain("https://feedl.app/alternative");
    expect(xml).toContain("https://feedl.app/how-to-collect-feedback");
    expect(xml).toContain("https://feedl.app/roadmap");
    expect(xml).toContain("<loc>"); // urlset formatı
    expect(res.headers.get("content-type")).toContain("application/xml");
  });

  it("derives the base URL from the request host (workspace/custom domain)", async () => {
    const res = await sitemapGET(req("/sitemap.xml", "acme.feedl.app"));
    const xml = await res.text();
    expect(xml).toContain("https://acme.feedl.app/pricing");
  });
});

describe("robots.txt", () => {
  it("allows crawl and disallows auth/api/widget surfaces", async () => {
    const res = await robotsGET(req("/robots.txt"));
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    for (const d of ["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/widget", "/api/"]) {
      expect(txt).toContain(`Disallow: ${d}`);
    }
  });

  it("names the sitemap URL in the robots output", async () => {
    const res = await robotsGET(req("/robots.txt", "feedl.app"));
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://feedl.app/sitemap.xml");
  });
});
