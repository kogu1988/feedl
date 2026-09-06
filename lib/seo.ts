import "server-only";

import { headers } from "next/headers";
import type { Metadata } from "next";

import { getWorkspaceBrand } from "@/lib/db/workspace";

// Sprint 63y (F2) — server-side canonical (tam path). App Router'da `generateMetadata`
// yalnız {params, searchParams} alır; tam path'i `x-feedl-pathname` (middleware
// ekler) + `x-forwarded-host` (host) ile kurarız. Workspace custom domain'i varsa
// ve ziyaretçi O domain'de DEĞİLSE (örn. acme.feedl.app), canonical custom domain'e
// işaret eder (duplike içerik/SEO bölünmesi önlenir). Bu, client-side
// canonical-link.tsx'in sunucu tarafı, kesin karşılığıdır — crawl kodu ilk HTML'de görür.

async function requestHost(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-host") ?? h.get("host") ?? "feedl.app"
  );
}

function hostFromUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/[/\s]+$/, "").toLowerCase();
}

// Kanonik metadata üretir; public yüzeylerin generateMetadata'ları çağırır.
export async function generateCanonical(): Promise<Metadata> {
  const h = await headers();
  const host = await requestHost();
  const pathname = h.get("x-feedl-pathname") ?? "/";
  const brand = await getWorkspaceBrand();

  // Workspace marka adı + custom domain. getWorkspaceBrand -> getWorkspaceId
  // host/cookie/widget-session ile doğru workspace'i çözer.
  const customDomain = brand.customDomain
    ? hostFromUrl(brand.customDomain)
    : null;

  // Kanonik host: ziyaretçi custom domain'de ise orayı koru; değilse custom domain
  // (varsa) ya da mevcut host.
  const canonicalHost = customDomain ?? hostFromUrl(host);
  const canonicalUrl = `https://${canonicalHost}${pathname}`;

  return {
    alternates: { canonical: canonicalUrl },
  };
}
