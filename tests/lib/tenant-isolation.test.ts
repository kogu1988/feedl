import { describe, expect, it, vi, beforeEach } from "vitest";

// Sprint 63x (test derinleştirme) — tenant izolasyonu: workspace çözümünün
// ÖNCELİK SIRASI. custom_domain > subdomain > varsayılan. Yanlış sıra,
// müşterinin custom domain'ini başka bir workspace'e düşürür (veri sızıntısı).
// getDb mock'lanır — gerçek SQL koşmaz, yalnız sorgu sırası/koşulu doğrulanır.
import { resolveWorkspaceByHost } from "@/lib/db/workspace";

type Row = { id: string; slug: string; name: string };

// Her sorgu (küresel sırayla) için dönecek sonuçlar.
let queryResults: Row[][] = [];
let queryIndex = 0;

vi.mock("@/lib/db", () => {
  return {
    getDb: vi.fn(() => {
      const chain = {
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
      };
      return {
        select: vi.fn(() => ({
          from: vi.fn(() => {
            const idx = queryIndex;
            queryIndex += 1;
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => queryResults[idx] ?? []),
              })),
            };
          }),
        })),
      };
    }),
  };
});

beforeEach(() => {
  queryResults = [];
  queryIndex = 0;
});

describe("resolveWorkspaceByHost precedence", () => {
  it("prefers a custom_domain match over subdomain slug", async () => {
    // 1. custom_domain sorgusu → acme bulunur.
    queryResults = [
      [{ id: "w_custom", slug: "acme", name: "Acme (custom)" }],
      [{ id: "w_sub", slug: "acme", name: "Acme" }],
      [{ id: "w_default", slug: "feedl", name: "feedl" }],
    ];
    const result = await resolveWorkspaceByHost("feedback.acme.com");
    expect(result.id).toBe("w_custom");
  });

  it("falls back to subdomain slug when no custom domain", async () => {
    // 1. custom_domain → yok; 2. subdomain slug (acme) → bulunur.
    queryResults = [
      [],
      [{ id: "w_sub", slug: "acme", name: "Acme" }],
      [{ id: "w_default", slug: "feedl", name: "feedl" }],
    ];
    const result = await resolveWorkspaceByHost("acme.feedl.app");
    expect(result.id).toBe("w_sub");
  });

  it("falls back to the default workspace when nothing matches", async () => {
    // 1. custom → yok; 2. subdomain slug → yok; 3. default → bulunur.
    queryResults = [[], [], [{ id: "w_default", slug: "feedl", name: "feedl" }]];
    const result = await resolveWorkspaceByHost("unknown-sub.feedl.app");
    expect(result.id).toBe("w_default");
    expect(result.slug).toBe("feedl");
  });

  it("throws when even the default workspace is missing (misconfig)", async () => {
    queryResults = [[], [], []];
    await expect(resolveWorkspaceByHost("acme.feedl.app")).rejects.toThrow(
      /bulunamadı/,
    );
  });
});
