import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// 2026-09-12 kod incelemesi — REGRESYON TESTİ.
//
// Eski kod `workspaceIdOverride`'ı MODÜL seviyesinde tutuyor ve hiçbir yerde
// sıfırlamıyordu. Serverless'ta warm instance aynı modülü yeniden kullandığı
// için değer bir sonraki isteğe sızıyordu. En tehlikeli senaryo:
//
//   İstek 1: /api/integrations/linear/webhook?ws=acme&t=<token>
//            → workspaceIdOverride = <acme id>   (ve DÖNÜŞTE SIFIRLANMIYOR)
//   İstek 2: /api/integrations/linear/webhook        (legacy, ?ws= yok)
//            → workspaceIdOverride ?? getWorkspaceId()
//            → acme'nin id'si  ❌  (kendi default workspace'i olmalıydı)
//
// Sonuç: bir müşterinin Linear feedback'i başka bir workspace'e yazılıyordu.
// Bu test AYNI modül örneğinde ardışık iki istek yapar ve izolasyonu kanıtlar.
// Düzeltme: değişken fonksiyon-lokal (`resolvedWorkspaceId`).

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
  isLinearConfigured: () => true,
  parseLinearPayload: () => ({ type: "Issue", data: { id: "lin-1" } }),
  linearDataText: () => ({ title: "T", body: "B" }),
  verifyLinearSignature: () => true,
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
  it("legacy istek, önceki per-workspace isteğin workspace'ini DEVRALMAZ", async () => {
    h.selectResults = [
      // İstek 1 — entegrasyon kaydı (acme) + workspace id aynı sorguda gelir.
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-acme" }],
      // İstek 1 — duplicate kontrolü: kayıt yok.
      [],
      // İstek 2 (legacy) — duplicate kontrolü: kayıt yok.
      [],
    ];

    const first = await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=acme&t=tok"),
    );
    const second = await POST(
      post("https://feedl.app/api/integrations/linear/webhook"),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(h.postValues).toHaveLength(2);
    // İstek 1 doğru tenant'a yazmalı...
    expect(h.postValues[0].workspaceId).toBe("ws-acme");
    // ...istek 2 ise KENDİ default workspace'ine (eski kodda "ws-acme" olurdu).
    expect(h.postValues[1].workspaceId).toBe("ws-default");
  });

  it("ters sıra da güvenli: legacy'den sonra gelen per-workspace isteği doğru tenant'a yazar", async () => {
    h.selectResults = [
      // İstek 1 (legacy) — duplicate kontrolü.
      [],
      // İstek 2 — entegrasyon kaydı (acme).
      [{ webhookSecret: "enc", urlToken: "tok", workspaceId: "ws-acme" }],
      // İstek 2 — duplicate kontrolü.
      [],
    ];

    await POST(post("https://feedl.app/api/integrations/linear/webhook"));
    await POST(
      post("https://feedl.app/api/integrations/linear/webhook?ws=acme&t=tok"),
    );

    expect(h.postValues[0].workspaceId).toBe("ws-default");
    expect(h.postValues[1].workspaceId).toBe("ws-acme");
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
