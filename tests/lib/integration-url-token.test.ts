import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (teknik borç #10) — entegrasyon webhook'larının güvenlik çekirdeği.
//
// Gelen entegrasyon webhook'ları (Linear/Jira/Zendesk/Slack/Intercom) workspace'i
// URL'deki `?ws=<slug>&t=<urlToken>` ile çözer. Bu token, kaydın TEK kapısıdır:
// yanlış/eşleşmeyen token 403 dönmeli ve HİÇBİR şey yazmamalıdır. Bu dosya
// paylaşılan `resolveIntegrationByUrlToken` + `urlTokenMatches` için sunucu
// kanıtı sağlar (Linear handler'ının kendi regresyon testi ayrıca var:
// tests/lib/linear-webhook-tenant.test.ts).

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  selectIndex: 0,
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

// Şifreleme gerçek anahtar istemesin; bu testin konusu kimlik doğrulama.
vi.mock("@/lib/encrypt", () => ({
  decryptSecret: (v: string | null) => v,
  encryptSecret: (v: string) => v,
  isEncryptionConfigured: () => true,
}));

import {
  resolveIntegrationByUrlToken,
  urlTokenMatches,
  warnLegacyInboundWebhook,
} from "@/lib/integrations";

beforeEach(() => {
  h.selectResults = [];
  h.selectIndex = 0;
  vi.restoreAllMocks();
});

describe("urlTokenMatches", () => {
  it("eşit token'ı kabul eder", () => {
    expect(urlTokenMatches("abc123", "abc123")).toBe(true);
  });

  it("aynı uzunlukta farklı token'ı reddeder", () => {
    expect(urlTokenMatches("abc123", "abc124")).toBe(false);
  });

  it("önek/kısa token'ı reddeder (uzunluk farkı erken çıkış yapmaz)", () => {
    expect(urlTokenMatches("abc123", "abc")).toBe(false);
    expect(urlTokenMatches("abc", "abc123")).toBe(false);
  });

  it("kayıtta token yoksa ASLA eşleşmez (boş kayıt kapıyı açamaz)", () => {
    expect(urlTokenMatches(null, "abc")).toBe(false);
    expect(urlTokenMatches(undefined, "abc")).toBe(false);
    expect(urlTokenMatches("", "abc")).toBe(false);
    expect(urlTokenMatches("", "")).toBe(false);
    expect(urlTokenMatches("abc", "")).toBe(false);
  });

  it("çok baytlı/ASCII dışı girdide patlamaz", () => {
    expect(urlTokenMatches("tökén", "tökén")).toBe(true);
    expect(urlTokenMatches("tökén", "token")).toBe(false);
  });
});

describe("resolveIntegrationByUrlToken", () => {
  const row = {
    id: "int-1",
    workspaceId: "ws-1",
    apiKey: null,
    webhookSecret: null,
    resourceTypes: null,
    urlToken: "tok-abc",
    baseUrl: null,
    accountEmail: null,
    webhookId: null,
  };

  it("slug + token eşleşince kaydı döner", async () => {
    h.selectResults = [[row]];
    const resolved = await resolveIntegrationByUrlToken("linear", "acme", "tok-abc");
    expect(resolved?.workspaceId).toBe("ws-1");
  });

  it("yanlış token → null (handler 403 döner, yazma olmaz)", async () => {
    h.selectResults = [[row]];
    expect(await resolveIntegrationByUrlToken("linear", "acme", "tok-xyz")).toBeNull();
  });

  it("kayıtta token yoksa → null (boş token'la eşleşmez)", async () => {
    h.selectResults = [[{ ...row, urlToken: null }]];
    expect(await resolveIntegrationByUrlToken("linear", "acme", "")).toBeNull();
  });

  it("o slug için entegrasyon yoksa → null", async () => {
    h.selectResults = [[]];
    expect(await resolveIntegrationByUrlToken("jira", "bilinmeyen", "tok-abc")).toBeNull();
  });

  it("provider kaydı farklıysa (sorgu boş dönerse) → null", async () => {
    // DB sorgusu provider'a göre filtreler; yanlış provider'da satır gelmez.
    h.selectResults = [[]];
    expect(await resolveIntegrationByUrlToken("zendesk", "acme", "tok-abc")).toBeNull();
  });
});

describe("warnLegacyInboundWebhook", () => {
  it("uyarı basar ve aynı provider için TEKRARLAMAZ (log spam'i yok)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnLegacyInboundWebhook("slack");
    warnLegacyInboundWebhook("slack");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("slack");
  });
});
