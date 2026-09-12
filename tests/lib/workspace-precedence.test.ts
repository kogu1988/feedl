import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (teknik borç #11) — `getWorkspaceId` çözüm ÖNCELİĞİ sunucu kanıtı.
//
// getWorkspaceId (lib/db/workspace.ts) üç sinyali sırayla dener:
//   1) widget oturumu (httpOnly `feedl_widget` çerezi → ws claim)
//   2) aktif workspace çerezi (`feedl_active_ws`, onboarding sonrası routing ipucu)
//   3) host çözümlemesi (doğrulanmış custom domain → subdomain slug → varsayılan)
//
// Yanlış sıra bir kiracının verisini diğerine düşürür. Bu dosya sırayı ve
// "bilinmeyen slug → sonraki sinyale düş" davranışını sabitler. Ayrıca son test
// modül seviyesinde bir önbellek REGRESYONUNU yakalar: bu repoda daha önce
// modül-global `cached` yüzünden A tenant'ının id'si B isteğine sızmıştı
// (bkz. lib/db/workspace.ts yorumu, Sprint 63w).

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  selectIndex: 0,
  host: "feedl.app",
  activeCookie: null as string | null,
  widgetSession: null as { workspaceSlug?: string | null } | null,
}));

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => h.selectResults[h.selectIndex++] ?? [],
  };
  return { getDb: () => ({ select: () => chain }) };
});

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-host" || name === "host" ? h.host : null,
  }),
  cookies: async () => ({
    get: (name: string) =>
      name === "feedl_active_ws" && h.activeCookie
        ? { value: h.activeCookie }
        : undefined,
  }),
}));

vi.mock("@/lib/widget/jwt", () => ({
  getWidgetSession: async () => h.widgetSession,
  toWidgetUserId: (id: string) => `user_${id}`,
}));

import { getWorkspaceId } from "@/lib/db/workspace";

// Şema `z.uuid()` doğruladığı için geçerli UUID kullanılmalı.
const WS_ACME = "11111111-1111-4111-8111-111111111111";
const WS_BETA = "22222222-2222-4222-8222-222222222222";
const WS_HOST = "33333333-3333-4333-8333-333333333333";
const WS_DEFAULT = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  h.selectResults = [];
  h.selectIndex = 0;
  h.host = "feedl.app";
  h.activeCookie = null;
  h.widgetSession = null;
});

describe("getWorkspaceId öncelik sırası", () => {
  it("widget oturumu hem çerezi hem host'u yener (müşteri sitesindeki widget kendi tenant'ında kalır)", async () => {
    h.widgetSession = { workspaceSlug: "acme" };
    h.activeCookie = "beta";
    h.host = "beta.feedl.app";
    h.selectResults = [[{ id: WS_ACME }]];

    await expect(getWorkspaceId()).resolves.toBe(WS_ACME);
  });

  it("widget oturumu yoksa aktif çerez host'u yener", async () => {
    h.activeCookie = "beta";
    h.host = "acme.feedl.app";
    h.selectResults = [[{ id: WS_BETA }]];

    await expect(getWorkspaceId()).resolves.toBe(WS_BETA);
  });

  it("iki çerez de yoksa host çözümlemesi kullanılır", async () => {
    h.host = "feedback.acme.com";
    // resolveWorkspaceByHost: doğrulanmış custom domain eşleşmesi.
    h.selectResults = [[{ id: WS_HOST, slug: "acme", name: "Acme" }]];

    await expect(getWorkspaceId()).resolves.toBe(WS_HOST);
  });

  it("bilinmeyen widget slug'ı host'a DÜŞMEZ, aktif çereze düşer", async () => {
    h.widgetSession = { workspaceSlug: "ghost" };
    h.activeCookie = "beta";
    h.selectResults = [
      [], // ghost slug → kayıt yok
      [{ id: WS_BETA }], // beta çerezi → bulunur
    ];

    await expect(getWorkspaceId()).resolves.toBe(WS_BETA);
  });

  it("bilinmeyen aktif çerez host çözümlemesine düşer", async () => {
    h.activeCookie = "ghost";
    h.host = "acme.feedl.app";
    h.selectResults = [
      [], // ghost slug → kayıt yok
      [], // custom domain → yok
      [{ id: WS_HOST, slug: "acme", name: "Acme" }], // subdomain slug → acme
    ];

    await expect(getWorkspaceId()).resolves.toBe(WS_HOST);
  });

  it("hiçbir sinyal yoksa varsayılan workspace'e düşer", async () => {
    h.selectResults = [
      [], // custom domain → yok
      [], // subdomain slug → yok
      [{ id: WS_DEFAULT, slug: "feedl", name: "feedl" }], // varsayılan
    ];

    await expect(getWorkspaceId()).resolves.toBe(WS_DEFAULT);
  });

  it("REGRESYON: ardışık iki istek birbirinin workspace'ini DEVRALMAZ (modül-global önbellek yasağı)", async () => {
    // İstek 1 — widget oturumu acme.
    h.widgetSession = { workspaceSlug: "acme" };
    h.selectResults = [[{ id: WS_ACME }]];
    await expect(getWorkspaceId()).resolves.toBe(WS_ACME);

    // İstek 2 — aynı modül örneği, farklı oturum (beta). Modül seviyesinde bir
    // önbellek olsaydı burada YANLIŞLIKLA WS_ACME dönerdi.
    h.widgetSession = { workspaceSlug: "beta" };
    h.selectIndex = 0;
    h.selectResults = [[{ id: WS_BETA }]];
    await expect(getWorkspaceId()).resolves.toBe(WS_BETA);
  });
});
