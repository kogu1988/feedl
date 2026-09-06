import { beforeEach, describe, expect, it } from "vitest";

// Sprint 63t — entegrasyon credential şifreleme (AES-256-GCM) roundtrip + geçiş.
// lib/encrypt server-only; Node (vitest) ortamında server-only no-op'tur.
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64");

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

describe("encryptSecret / decryptSecret", () => {
  it("roundtrips a secret", async () => {
    // ESM importları statik; modül düzeyinde env okunur → hazır set ettik.
    const { encryptSecret, decryptSecret } = await import("@/lib/encrypt");
    const enc = encryptSecret("xoxb-super-secret-token");
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain("xoxb-super-secret-token");
    expect(decryptSecret(enc)).toBe("xoxb-super-secret-token");
  });

  it("passes through already-encrypted values", async () => {
    const { encryptSecret } = await import("@/lib/encrypt");
    const enc = encryptSecret("abc");
    expect(encryptSecret(enc)).toBe(enc);
  });

  it("passes through plaintext (backward compat for existing rows)", async () => {
    const { decryptSecret } = await import("@/lib/encrypt");
    // Eski düz satır (şifrelenmemiş) aynen döner.
    expect(decryptSecret("plain-old-secret")).toBe("plain-old-secret");
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret("")).toBe("");
  });

  it("returns null for tampered/invalid ciphertext", async () => {
    const { decryptSecret } = await import("@/lib/encrypt");
    expect(decryptSecret("enc:v1:bad")).toBeNull();
    expect(decryptSecret("enc:v1:::" )).toBeNull();
  });
});
