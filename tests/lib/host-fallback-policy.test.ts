import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (fail-closed host kararı) — var olmayan bir alt alan veya
// DOĞRULANMAMIŞ bir custom domain artık varsayılan workspace'i GÖSTERMEZ.
//
// Önceki davranış: `resolveWorkspaceByHost` her zaman varsayılan `feedl`
// workspace'ine düşerdi. Wildcard DNS ile birleşince `her-ne-yazarsan.feedl.app`
// 200 dönüyor, kendi canonical'ını yazıyor (sınırsız duplicate-content) ve
// markayı rastgele hostname'lere ödünç veriyordu. Ayrıca custom domain yolu
// tutmayan `feedback.acme.com` gibi bir host `slugFromHost` üzerinden "feedl"
// slug'ına sorgu atıp varsayılan workspace'i servis ediyordu (tenant sızıntısı).
//
// Bu dosya üç saf/kapı fonksiyonunu sabitler:
//   isDefaultFallbackHost   → hangi host'ta varsayılana düşmek GÜVENLİ
//   subdomainSlugFromHost   → feedl dışı host'ta slug YOK (null)
//   resolveWorkspaceForHostname → bilinmeyen host'ta null (çağıran 404 verir)
// `resolveWorkspaceByHost`'un geriye dönük sözleşmesi
// tests/lib/tenant-isolation.test.ts'te ayrıca korunur.

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  selectIndex: 0,
  host: "feedl.app",
  noHeaders: false,
}));

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => h.selectResults[h.selectIndex++] ?? [],
  };
  return { getDb: () => ({ select: () => chain }) };
});

vi.mock("next/headers", () => ({
  headers: async () => {
    // Build/prerender taklidi: `headers()` fırlatır (bkz. getRequestHostOrNull).
    if (h.noHeaders) throw new Error("Dynamic server usage");
    return {
      get: (name: string) =>
        name === "x-forwarded-host" || name === "host" ? h.host : null,
    };
  },
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/widget/jwt", () => ({
  getWidgetSession: async () => null,
}));

import {
  isDefaultFallbackHost,
  isFeedlRootRequest,
  subdomainSlugFromHost,
  resolveWorkspaceForHostname,
} from "@/lib/db/workspace";

const DEFAULT_WS = { id: "44444444-4444-4444-8444-444444444444", slug: "feedl", name: "feedl" };
const ACME_WS = { id: "11111111-1111-4111-8111-111111111111", slug: "acme", name: "Acme" };

beforeEach(() => {
  h.selectResults = [];
  h.selectIndex = 0;
  h.host = "feedl.app";
  h.noHeaders = false;
  vi.unstubAllEnvs();
});

describe("isDefaultFallbackHost — varsayılana düşmesi güvenli host'lar", () => {
  it("feedl kök host'ları true", () => {
    expect(isDefaultFallbackHost("feedl.app")).toBe(true);
    expect(isDefaultFallbackHost("www.feedl.app")).toBe(true);
    expect(isDefaultFallbackHost("FEEDL.APP")).toBe(true);
    expect(isDefaultFallbackHost("feedl.app:443")).toBe(true);
  });

  it("NEXT_PUBLIC_APP_URL host'u true (yerel geliştirme)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(isDefaultFallbackHost("localhost:3000")).toBe(true);
  });

  it("loopback her zaman true — NEXT_PUBLIC_APP_URL feedl.app olsa bile (yerel DX regresyonu)", () => {
    // .env.local → NEXT_PUBLIC_APP_URL=https://feedl.app iken localhost kök host
    // SAYILMAZ; loopback kuralı olmasa `npm run dev` sonrası her sayfa 404 olurdu.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://feedl.app");
    expect(isDefaultFallbackHost("localhost:3000")).toBe(true);
    expect(isDefaultFallbackHost("127.0.0.1:3000")).toBe(true);
    expect(isDefaultFallbackHost("[::1]:3000")).toBe(true);
  });

  it("kendi Vercel preview deploy'ları true", () => {
    expect(isDefaultFallbackHost("feedl-abc123.vercel.app")).toBe(true);
    expect(isDefaultFallbackHost("feedl-git-main-kogu.vercel.app")).toBe(true);
  });

  it("bilinmeyen alt alan ve yabancı host'lar false", () => {
    expect(isDefaultFallbackHost("acme.feedl.app")).toBe(false);
    expect(isDefaultFallbackHost("kesinlikleyok12345.feedl.app")).toBe(false);
    expect(isDefaultFallbackHost("feedback.acme.com")).toBe(false);
    expect(isDefaultFallbackHost("example.com")).toBe(false);
    // Dikkat: sonu "vercel.app" ile biten ama farklı bir kayıt (evil-vercel.app)
    // eşleşmemeli — kontrol `.vercel.app` sonekiyle yapılır.
    expect(isDefaultFallbackHost("evil-vercel.app")).toBe(false);
  });
});

describe("subdomainSlugFromHost — feedl dışı host'ta slug YOK", () => {
  it("feedl alt alanından slug çıkarır", () => {
    expect(subdomainSlugFromHost("acme.feedl.app")).toBe("acme");
  });

  it("kök host varsayılan slug'ı verir", () => {
    expect(subdomainSlugFromHost("feedl.app")).toBe("feedl");
    expect(subdomainSlugFromHost("www.feedl.app")).toBe("feedl");
  });

  it("feedl.app ailesine ait olmayan host'ta null döner (varsayılana kaymaz)", () => {
    expect(subdomainSlugFromHost("feedback.acme.com")).toBeNull();
    expect(subdomainSlugFromHost("example.com")).toBeNull();
    expect(subdomainSlugFromHost("feedl-abc.vercel.app")).toBeNull();
  });
});

describe("isFeedlRootRequest — header marka kapsamı (rakip standardı)", () => {
  it("feedl kök host'larında true (marka her zaman feedl)", async () => {
    for (const host of ["feedl.app", "www.feedl.app", "feedl.app:443"]) {
      h.host = host;
      await expect(isFeedlRootRequest()).resolves.toBe(true);
    }
  });

  it("workspace alt alanında false (marka müşterinin adı/logo'su)", async () => {
    h.host = "acme.feedl.app";
    await expect(isFeedlRootRequest()).resolves.toBe(false);
    h.host = "feedback.acme.com";
    await expect(isFeedlRootRequest()).resolves.toBe(false);
  });

  it("istek bağlamı yoksa (build/prerender) true — statik üretim feedl markası", async () => {
    h.noHeaders = true;
    await expect(isFeedlRootRequest()).resolves.toBe(true);
  });
});

describe("resolveWorkspaceForHostname — fail-closed kapı", () => {
  it("bilinmeyen alt alan → null, ve VARSAYILAN sorgusu HİÇ koşmaz", async () => {
    h.selectResults = [
      [], // custom domain → yok
      [], // slug 'kesinlikleyok' → yok
      // (varsayılan workspace sorgusu BEKLENMİYOR)
    ];
    await expect(
      resolveWorkspaceForHostname("kesinlikleyok12345.feedl.app"),
    ).resolves.toBeNull();
    // Yalnız 2 sorgu: custom domain + slug. Üçüncü sorgu koşsaydı varsayılana
    // düşülmüş olurdu (eski hata).
    expect(h.selectIndex).toBe(2);
  });

  it("feedl dışı, doğrulanmamış host → null (slug'a 'feedl' diye sorgu ATMAZ)", async () => {
    h.selectResults = [[]]; // custom domain → yok
    await expect(resolveWorkspaceForHostname("feedback.acme.com")).resolves.toBeNull();
    // Tek sorgu: custom domain. Eski kodda `slugFromHost` varsayılanı döndürüp
    // ikinci sorguyla varsayılan workspace'i servis ediyordu (sızıntı).
    expect(h.selectIndex).toBe(1);
  });

  it("var olan alt alan slug'ı → o workspace", async () => {
    h.selectResults = [[], [ACME_WS]];
    await expect(resolveWorkspaceForHostname("acme.feedl.app")).resolves.toEqual(ACME_WS);
  });

  it("kök host → varsayılan workspace", async () => {
    h.selectResults = [[DEFAULT_WS]];
    await expect(resolveWorkspaceForHostname("feedl.app")).resolves.toEqual(DEFAULT_WS);
  });

  it("Vercel preview host'u → varsayılan workspace", async () => {
    h.selectResults = [[DEFAULT_WS]];
    await expect(
      resolveWorkspaceForHostname("feedl-abc123.vercel.app"),
    ).resolves.toEqual(DEFAULT_WS);
  });

  it("doğrulanmış custom domain → o workspace", async () => {
    h.selectResults = [[ACME_WS]];
    await expect(resolveWorkspaceForHostname("feedback.acme.com")).resolves.toEqual(ACME_WS);
  });
});
