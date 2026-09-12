import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// 2026-09-12 kod incelemesi — REGRESYON TESTİ.
//
// Eski kod `workspaceIdOverride`'ı MODÜL seviyesinde tutuyor ve hiçbir yerde
// sıfırlamıyordu. Serverless'ta warm instance aynı modülü yeniden kullandığı
// için değer bir sonraki isteğe sızıyordu: `?ws=acme` isteğinden sonra gelen
// parametresiz istek kendi workspace'i yerine acme'nin workspace'ine yazıyordu
// → cross-tenant yazma. Düzeltme: değişken fonksiyon-lokal
// (`resolvedWorkspaceId`).
//
// 2026-09-12 (Faz 3): legacy (parametresiz) yol tamamen emekliye ayrıldı ve
// artık 403 döner. Fonksiyon-lokal garantisi yine de kritik: aynı warm
// instance'a düşen iki farklı workspace isteği interleave olabilir. Bu dosya
// hem 403 emekliliğini hem de ardışık isteklerde tenant izolasyonunu kanıtlar.

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  selectIndex: 0,
  postValues: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db", () => {
  // Drizzle'ın zincirini taklit eder: select().from().[innerJoin]().where().limit()
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => h.selectResults[h.selectIndex++] ?? [],
  };
  return {
    getDb: () => ({
      select: () => chain,
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: async () => undefined,
          returning: async () => {
            h.postValues.push(values);
            return [{ id: "11111111-1111-4111-8111-111111111111", title: "T" }];
          },
        }),
      }),
    }),
  };
});

vi.mock("@/lib/db/workspace", () => ({
  getWorkspaceId: vi.fn(async () => "ws-default"),
}));
vi.mock("@/lib/db/board", () => ({
  getDefaultBoardId: vi.fn(async () => "board-1"),
}));
vi.mock("@/lib/ai/analysis", () => ({
  classifyWidgetMessage: vi.fn(async () => ({ classification: "feedback" })),
}));
vi.mock("@/lib/linear", () => ({
  parseLinearPayload: () => ({ type: "Issue", data: { id: "lin-1" } }),
  linearDataText: () => ({ title: "T", body: "B" }),
  verifyLinearSignatureWithSecret: () => true,
}));
vi.mock("@/lib/encrypt", () => ({
  decryptSecret: (v: string | null) => v,
  encryptSecret: (v: string) => v,
  isEncryptionConfigured: () => true,
}));
vi.mock("@/lib/widget/jwt", () => ({
  toWidgetUserId: (id: string) => `user_${id}`,
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => undefined) },
}));

import { POST } from "@/app/api/integrations/linear/webhook/route";

const BODY = JSON.stringify({ data: { id: "lin-1" } });

function post(url: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "x-linear-signature": "sig" },
    body: BODY,
  });
}

beforeEach(() => {
  h.selectResults = [];
  h.selectIndex = 0;
  h.postValues = [];
});

describe("POST /api/integrations/linear/webhook — tenant izolasyonu", () => {
  it("ardışık iki per-workspace isteği birbirinin workspace'ini DEVRALMAZ", async () => {
    h.selectResults = [
      // İstek 1 — entegrasyon kaydı (acme) + workspace id aynı sorguda gelir.
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-acme" }],
      // İstek 1 — duplicate kontrolü: kayıt yok.
      [],
      // İstek 2 — entegrasyon kaydı (beta).
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-beta" }],
      // İstek 2 — duplicate kontrolü: kayıt yok.
      [],
    ];

    const first = await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=acme&t=tok"),
    );
    const second = await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=beta&t=tok"),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(h.postValues).toHaveLength(2);
    // Her istek yalnızca kendi çözdüğü tenant'a yazmalı.
    expect(h.postValues[0].workspaceId).toBe("ws-acme");
    expect(h.postValues[1].workspaceId).toBe("ws-beta");
  });

  it("ters sıra da güvenli (izolasyon sıradan bağımsız)", async () => {
    h.selectResults = [
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-beta" }],
      [],
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-acme" }],
      [],
    ];

    await POST(post("https://feedl.app/api/integrations/linear/webhook?ws=beta&t=tok"));
    await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=acme&t=tok"),
    );

    expect(h.postValues[0].workspaceId).toBe("ws-beta");
    expect(h.postValues[1].workspaceId).toBe("ws-acme");
  });

  it("parametresiz (legacy) istek 403 döner ve hiçbir şey yazılmaz", async () => {
    const res = await POST(post("https://feedl.app/api/integrations/linear/webhook"));
    expect(res.status).toBe(403);
    expect(h.postValues).toHaveLength(0);
  });

  it("per-workspace kaydı yoksa 404 döner ve post yazılmaz", async () => {
    h.selectResults = [[]];
    const res = await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=yok&t=tok"),
    );
    expect(res.status).toBe(404);
    expect(h.postValues).toHaveLength(0);
  });
});
