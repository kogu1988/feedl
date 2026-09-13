import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (plan matrisi, kullanıcı kararı) — REGRESYON TESTİ.
//
// "Gizli (private) board" plan kartlarında Pro olarak pazarlanıyordu ama
// kodda plan kapısı YOKTU: Free bir workspace gizli board açabiliyordu. Bu
// dosya kapının gerçekten çalıştığını sunucu tarafında kanıtlar:
//   - POST  : private + free → 403, HİÇ yazma yok
//   - POST  : private + pro  → 201
//   - POST  : public  + free → 201 (public Free'de kalır)
//   - PATCH : public→private + free → 403
//   - PATCH : ad değişikliği, zaten private + free → 200 (kapı yalnız
//             GEÇİŞİ engeller; kapı eklenmeden önce oluşmuş gizli board'ın
//             adı düzenlenebilmeli)

const h = vi.hoisted(() => ({
  plan: "free" as "free" | "pro",
  selectResults: [] as unknown[][],
  selectIndex: 0,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminUserId: async () => "user-1",
}));

vi.mock("@/lib/db/workspace", () => ({
  getWorkspaceId: async () => "ws-1",
}));

vi.mock("@/lib/db/board", () => ({
  getDefaultBoardId: async () => "board-default",
}));

// enforceLimit ve getPlanLimits gerçek modülden gelir ama DB istemez.
vi.mock("@/lib/paddle", () => ({
  enforceLimit: async () => ({ ok: true, limit: 99 }),
  getPlanLimits: async () => ({
    key: h.plan,
    label: h.plan,
    trackedUserLimit: h.plan === "pro" ? Number.MAX_SAFE_INTEGER : 50,
    boardLimit: h.plan === "pro" ? Number.MAX_SAFE_INTEGER : 1,
    memberLimit: h.plan === "pro" ? 10 : 1,
  }),
}));

vi.mock("@/lib/db", () => {
  // Drizzle zinciri: select().from().where() ve ...limit() ikisi de await
  // edilebilir olmalı → `then` ile thenable yapıldı; her await bir sonucu
  // tüketir.
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => unknown) =>
      resolve(h.selectResults[h.selectIndex++] ?? []),
  };
  return {
    getDb: () => ({
      select: () => chain,
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            h.inserted.push(values);
            return [{ id: "board-new", ...values }];
          },
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              h.updated.push(values);
              return [{ id: "board-1", ...values }];
            },
          }),
        }),
      }),
    }),
  };
});

import { POST, PATCH } from "@/app/api/admin/boards/route";

// PATCH `id` alanını z.uuid() ile doğrular.
const BOARD_ID = "11111111-1111-4111-8111-111111111111";

function postRequest(body: unknown): Request {
  return new Request("https://feedl.app/api/admin/boards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: unknown): Request {
  return new Request(`https://feedl.app/api/admin/boards?id=${BOARD_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.plan = "free";
  h.selectResults = [];
  h.selectIndex = 0;
  h.inserted = [];
  h.updated = [];
});

describe("POST /api/admin/boards — gizli board Pro kapısı", () => {
  it("free + private → 403 döner ve HİÇ board yazılmaz", async () => {
    const res = await POST(postRequest({ name: "Gizli", visibility: "private" }));
    expect(res.status).toBe(403);
    expect(h.inserted).toHaveLength(0);
  });

  it("pro + private → 201 ve gizli olarak yazılır", async () => {
    h.plan = "pro";
    h.selectResults = [[{ value: 0 }]]; // board sayımı
    const res = await POST(postRequest({ name: "Gizli", visibility: "private" }));
    expect(res.status).toBe(201);
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0].visibility).toBe("private");
  });

  it("free + public → 201 (public Free planda kalır)", async () => {
    h.selectResults = [[{ value: 0 }]];
    const res = await POST(postRequest({ name: "Açık", visibility: "public" }));
    expect(res.status).toBe(201);
    expect(h.inserted[0].visibility).toBe("public");
  });
});

describe("PATCH /api/admin/boards — gizliye çevirme Pro kapısı", () => {
  it("free + public→private → 403 ve update YAZILMAZ", async () => {
    h.selectResults = [[{ id: BOARD_ID, slug: "acik", visibility: "public" }]];
    const res = await PATCH(patchRequest({ visibility: "private" }));
    expect(res.status).toBe(403);
    expect(h.updated).toHaveLength(0);
  });

  it("free + zaten private olan board'ın adı düzenlenebilir (403 YOK)", async () => {
    // Kapı eklenmeden önce oluşmuş gizli board senaryosu: visibility 'private'
    // gönderilir ama DEĞİŞMİYOR → yeni yetenek kazanılmaz, engellenmemeli.
    h.selectResults = [[{ id: BOARD_ID, slug: "gizli", visibility: "private" }]];
    const res = await PATCH(
      patchRequest({ name: "Yeni ad", visibility: "private" }),
    );
    expect(res.status).toBe(200);
    expect(h.updated).toHaveLength(1);
  });

  it("pro + public→private → 200", async () => {
    h.plan = "pro";
    h.selectResults = [[{ id: BOARD_ID, slug: "acik", visibility: "public" }]];
    const res = await PATCH(patchRequest({ visibility: "private" }));
    expect(res.status).toBe(200);
    expect(h.updated[0].visibility).toBe("private");
  });
});
