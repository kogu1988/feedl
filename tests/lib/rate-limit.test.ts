import { describe, expect, it } from "vitest";

// Sprint 63i (test derinleştirme) — rate-limit yardımcıları (saf).
import { clientIpFrom, rateKey } from "@/lib/rate-limit";

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
