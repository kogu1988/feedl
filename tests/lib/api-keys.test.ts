import { describe, expect, it } from "vitest";

// Sprint 63i (test derinleştirme) — API anahtarı üretim/karma (saf).
import { generateApiKey, generateWebhookSecret, hashApiKey } from "@/lib/api-keys";

describe("api keys", () => {
  it("generates a key with fk_live_ prefix and a 12-char prefix", () => {
    const { key, prefix, keyHash } = generateApiKey();
    expect(key.startsWith("fk_live_")).toBe(true);
    expect(key.length).toBe(8 + 32); // fk_live_ + 32 hex
    expect(prefix).toBe(key.slice(0, 12));
    expect(prefix).toBe("fk_live_" + key.slice(8, 12));
    expect(keyHash).toBe(hashApiKey(key));
  });

  it("hashes deterministically with sha256", () => {
    const a = hashApiKey("fk_live_abc");
    const b = hashApiKey("fk_live_abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe("fk_live_abc");
  });

  it("generates a webhook secret with whsec_ prefix", () => {
    const s = generateWebhookSecret();
    expect(s.startsWith("whsec_")).toBe(true);
    expect(s.length).toBe(6 + 24); // whsec_ + 24 hex
  });
});
