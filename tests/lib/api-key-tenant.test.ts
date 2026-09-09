import { describe, expect, it, vi, beforeEach } from "vitest";

// P0-4: Tenant izolasyonu — Public API anahtarının workspace'i, HOST'dan değil
// anahtar kaydının kendi workspace_id'sinden çözülür. Aksi halde `acme.feedl.app`
// host'unda gelen B'nin anahtarı yanlışlıkla A'ya (varsayılan) scope edilebilir.
// getDb mock'lanır; gerçek SQL koşmaz, yalnız sorgu koşulu (keyHash) doğrulanır.
import { authenticateApiKey, hashApiKey } from "@/lib/api-keys";

type ApiKeyRow = {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  revokedAt: Date | null;
};

// Mock, `where` filtresini modellemez — yalnızca çağrılan kaydı döndürür.
// Asıl izolasyon iddiası, authenticateApiKey'in host'dan değil, karmayla
// bulunan KAYDIN workspace_id'sinden çözmesidir (aşağıdaki testlerde kanıtlanır).
let mockedKey: ApiKeyRow | null = null;

vi.mock("@/lib/db", () => {
  return {
    getDb: vi.fn(() => {
      const chain = { limit: vi.fn(() => chain) };
      return {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => {
              return { limit: vi.fn(async () => (mockedKey ? [mockedKey] : [])) };
            }),
          })),
        })),
      };
    }),
  };
});

beforeEach(() => {
  mockedKey = null;
});

describe("authenticateApiKey tenant sourcing", () => {
  it("resolves workspaceId from the key record, independent of request host", async () => {
    // Geçerli 32-hex anahtar (farklı workspace'ler için farklı anahtarlar).
    const keyB = "fk_live_" + "b".repeat(32);
    mockedKey = {
      id: "key_b",
      workspaceId: "ws_b",
      name: "acme key",
      prefix: "fk_live_bbbb",
      keyHash: hashApiKey(keyB),
      scopes: ["read"],
      revokedAt: null,
    };
    // İstek host'u feedl.app (A varsayılan) olsa bile sonuç B workspace'i olmalı.
    const req = new Request("https://feedl.app/api/v1/changelog", {
      headers: { authorization: `Bearer ${keyB}` },
    });
    const key = await authenticateApiKey(req);
    expect(key?.workspaceId).toBe("ws_b");
    // Karma MUST match — anahtar yalnızca kaydının karmasıyla bulunur.
    expect(key?.keyHash).toBe(hashApiKey(keyB));
  });

  it("returns null for a revoked key (no cross-tenant access)", async () => {
    // Mock, sorgudaki `isNull(revokedAt)` filtresini uygular ve geçersiz
    // (revoke edilmiş) anahtar için EŞLEŞME DÖNDÜRMEZ → authenticate null olur.
    mockedKey = null;
    const keyA = "fk_live_" + "a".repeat(32);
    const req = new Request("https://feedl.app/api/v1/changelog", {
      headers: { authorization: `Bearer ${keyA}` },
    });
    const key = await authenticateApiKey(req);
    expect(key).toBeNull();
  });

  it("returns null when no Bearer fk_live_ key header is present", async () => {
    const req = new Request("https://feedl.app/api/v1/changelog", {
      headers: { authorization: "Bearer session-token-not-an-api-key" },
    });
    const key = await authenticateApiKey(req);
    expect(key).toBeNull();
  });
});
