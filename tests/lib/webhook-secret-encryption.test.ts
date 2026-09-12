import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 kod incelemesi — `webhookEndpoints.secret` DB'de DÜZ METİN
// saklanıyordu. DB dökümü sızarsa saldırgan, müşterinin webhook alıcısına
// GEÇERLİ İMZALI sahte event gönderebilirdi.
//
// Bu test gerçek crypto'yu (lib/encrypt) ve gerçek dispatch'i kullanır; yalnız
// DB katmanı mock'lanır. Kanıtlanan sözleşme:
//   1. Yazarken secret `enc:v1:` ile şifrelenir (düz metin DB'ye GİRMEZ),
//   2. Teslimat yolunda düz haline geri çözülür (imza doğru üretilir),
//   3. Geçiş: eski düz satırlar bozulmadan çalışmaya devam eder.

const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64");

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  selectIndex: 0,
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db", () => {
  const next = async () => h.selectResults[h.selectIndex++] ?? [];
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => next();
  // dispatch `.where(...)` sonucunu doğrudan await eder; başka yerler
  // `.where(...).limit()` der. İkisini de destekle.
  chain.where = () => {
    const p = Promise.resolve().then(next) as unknown as Record<string, unknown>;
    p.limit = () => next();
    return p;
  };
  return {
    getDb: () => ({
      select: () => chain,
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            h.inserts.push(values);
            return [{ id: "11111111-1111-4111-8111-111111111111", url: values.url }];
          },
        }),
      }),
    }),
  };
});

vi.mock("@/lib/db/workspace", () => ({ getWorkspaceId: async () => "ws-1" }));
vi.mock("@/lib/auth/admin", () => ({ getAdminUserId: async () => "user-1" }));
vi.mock("@/lib/plan", () => ({ requirePro: async () => null }));

beforeEach(() => {
  // lib/encrypt anahtarı modül düzeyinde okur → env'i import'tan ÖNCE kur,
  // modül grafiğini sıfırla.
  process.env.ENCRYPTION_KEY = KEY;
  vi.resetModules();
  h.selectResults = [];
  h.selectIndex = 0;
  h.inserts = [];
});

// `vi.resetModules()` + ağır modül grafiği import'u (admin webhooks route tüm
// bağımlılıklarını yeniden yükler) bu testi paralel yükte ~5s'ye taşıyabiliyor;
// varsayılan 5s timeout flake üretiyordu (2026-09-12'de iki kez görüldü).
describe("webhook secret — at-rest şifreleme", { timeout: 30_000 }, () => {
  it("secret şifreli yazılır, teslimat için düz olarak çözülür", async () => {
    const { POST } = await import("@/app/api/admin/webhooks/route");
    const res = await POST(
      new Request("http://localhost/api/admin/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/hook",
          events: ["post.created"],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { secret: string } };
    const plaintext = body.data.secret;
    const stored = String(h.inserts[0].secret);

    // 1) DB'ye giden değer şifreli ve düz metni İÇERMİYOR.
    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain(plaintext);
    // Kullanıcıya düz hali (bir kez) döner — mevcut davranış korunur.
    expect(plaintext.length).toBeGreaterThan(10);

    // 2) Teslimat yolu: şifreli satır düz olarak çözülür.
    const { loadWebhookEndpoints } = await import("@/lib/webhooks/dispatch");
    h.selectResults = [
      [{ id: "e1", url: "https://example.com/hook", secret: stored }],
    ];
    const endpoints = await loadWebhookEndpoints("post.created");
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].secret).toBe(plaintext);
  });

  it("geçiş: eski düz metin satırlar bozulmadan çalışır", async () => {
    const { loadWebhookEndpoints } = await import("@/lib/webhooks/dispatch");
    h.selectResults = [
      [{ id: "e2", url: "https://legacy.example/hook", secret: "plain-legacy" }],
    ];
    const endpoints = await loadWebhookEndpoints("post.created");
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].secret).toBe("plain-legacy");
  });

  it("çözülemeyen (bozuk/anahtar değişmiş) secret teslim EDİLMEZ", async () => {
    const { loadWebhookEndpoints } = await import("@/lib/webhooks/dispatch");
    // Başka bir anahtarla üretilmiş gibi: auth tag tutmaz.
    h.selectResults = [
      [{ id: "e3", url: "https://x/hook", secret: "enc:v1:AAAA:BBBB:CCCC" }],
    ];
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const endpoints = await loadWebhookEndpoints("post.created");
    expect(endpoints).toHaveLength(0);
    errSpy.mockRestore();
  });
});
