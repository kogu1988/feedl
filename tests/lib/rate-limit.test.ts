import { describe, expect, it, vi } from "vitest";

// Sprint 63i (test derinleştirme) — rate-limit yardımcıları (saf).
import { clientIpFrom, rateKey } from "@/lib/rate-limit";

// Limiter'ın kendisi (Upstash/in-process) mock'lanır; burada yalnız
// `enforceInboundWebhookRateLimit` sözleşmesi sınanır.
vi.mock("@/lib/api-keys", () => ({ checkRateLimit: vi.fn() }));
import { checkRateLimit } from "@/lib/api-keys";
import {
  enforceInboundWebhookRateLimit,
  INBOUND_WEBHOOK_RATE_LIMIT,
} from "@/lib/rate-limit";

describe("rateKey", () => {
  it("joins scope and id with a colon", () => {
    expect(rateKey("posts:user", "user_123")).toBe("posts:user:user_123");
    expect(rateKey("posts:ip", "1.2.3.4")).toBe("posts:ip:1.2.3.4");
  });
});

describe("clientIpFrom", () => {
  it("takes the first x-forwarded-for value", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIpFrom(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then unknown", () => {
    const real = new Request("http://x", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientIpFrom(real)).toBe("9.9.9.9");

    const none = new Request("http://x");
    expect(clientIpFrom(none)).toBe("unknown");
  });
});

describe("enforceInboundWebhookRateLimit (2026-09-12 incelemesi)", () => {
  const mock = vi.mocked(checkRateLimit);

  it("sağlayıcı+IP ile anahtarlar", async () => {
    mock.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const res = await enforceInboundWebhookRateLimit(req, "linear");
    expect(res).toBeNull();
    expect(mock).toHaveBeenCalledWith("webhook:linear:1.2.3.4", INBOUND_WEBHOOK_RATE_LIMIT);
  });

  it("aşıldığında 429 + Retry-After + doğru limit başlığı döner", async () => {
    mock.mockResolvedValue({ allowed: false, retryAfterSec: 12 });
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const res = await enforceInboundWebhookRateLimit(req, "jira");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("12");
    expect(res?.headers.get("X-RateLimit-Limit")).toBe(
      String(INBOUND_WEBHOOK_RATE_LIMIT.limit),
    );
  });
});
