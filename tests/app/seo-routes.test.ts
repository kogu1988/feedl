import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// SEO-regresyon: sitemap.xml ve robots.txt App Router route handler'ları.
// Bunlar SEO için kritik (crawl + indexability) ve yeni SEO sayfaları
// (alternative / how-to-collect-feedback) sitemap'e alınmalı;
// robots, indexlenmemesi gereken yüzeyleri (auth/api/widget) disallow eder.
//
// 2026-09-12 (fail-closed): handler'lar artık host'un bilinen bir workspace'e
// çözülüp çözülmediğine bakar. DB'ye gitmemek için çözümleme mock'lanır;
// gerçek çözümleme mantığı tests/lib/host-fallback-policy.test.ts'te kanıtlı.
const h = vi.hoisted(() => ({ resolved: true }));

vi.mock("@/lib/db/workspace", () => ({
  resolveWorkspaceForHostname: async () =>
    h.resolved ? { id: "x", slug: "feedl", name: "feedl" } : null,
}));

import { GET as sitemapGET } from "@/app/sitemap.xml/route";
import { GET as robotsGET } from "@/app/robots.txt/route";

function req(path: string, host = "feedl.app"): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: { "x-forwarded-host": host },
  });
}

beforeEach(() => {
  h.resolved = true;
});

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
    // Anket sayfası noindex: sitemap'e ASLA girmez.
    expect(xml).not.toContain("/survey");
    expect(res.headers.get("content-type")).toContain("application/xml");
  });

  it("derives the base URL from the request host (workspace/custom domain)", async () => {
    const res = await sitemapGET(req("/sitemap.xml", "acme.feedl.app"));
    const xml = await res.text();
    expect(xml).toContain("https://acme.feedl.app/pricing");
  });

  it("bilinmeyen host'ta BOŞ urlset döner ve noindex başlığı taşır", async () => {
    h.resolved = false;
    const res = await sitemapGET(req("/sitemap.xml", "kesinlikleyok12345.feedl.app"));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).not.toContain("<loc>");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("robots.txt", () => {
  it("allows crawl and disallows auth/api/widget surfaces", async () => {
    const res = await robotsGET(req("/robots.txt"));
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    for (const d of ["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/widget", "/survey", "/api/"]) {
      expect(txt).toContain(`Disallow: ${d}`);
    }
  });

  it("names the sitemap URL in the robots output", async () => {
    const res = await robotsGET(req("/robots.txt", "feedl.app"));
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://feedl.app/sitemap.xml");
  });

  it("bilinmeyen host'ta taramayı tümüyle kapatır (fail-closed)", async () => {
    h.resolved = false;
    const res = await robotsGET(req("/robots.txt", "kesinlikleyok12345.feedl.app"));
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("Disallow: /");
    expect(txt).not.toContain("Allow: /");
    expect(txt).not.toContain("Sitemap:");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});
