import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("ENCRYPTION_KEY eksikken sessiz düşüş (2026-09-12 incelemesi)", () => {
  it("production'da BİR KEZ gürültülü uyarır, düz metne yine düşer", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.ENCRYPTION_KEY;
    const captureMessage = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ captureMessage }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { encryptSecret, decryptSecret } = await import("@/lib/encrypt");

    // Anahtar yok: değer düz geçer (mevcut davranış korunur)...
    expect(encryptSecret("plain-value")).toBe("plain-value");
    expect(decryptSecret("plain-value")).toBe("plain-value");
    // ...ama artık SESSİZ DEĞİL: Sentry'ye hata gider.
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage.mock.calls[0][1]).toMatchObject({
      level: "error",
      tags: { area: "encrypt" },
    });

    // Aynı süreçte tekrar çağrılırsa spam etmez.
    encryptSecret("another");
    decryptSecret("another");
    expect(captureMessage).toHaveBeenCalledTimes(1);

    errSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.doUnmock("@sentry/nextjs");
  });
});
