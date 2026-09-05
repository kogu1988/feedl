import { createHmac } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";

// Sprint 61 (Claude #2, KABUL) — Paddle webhook imzası + plan türetme.
// Test, gerçek `verifyPaddleSignature`'ı kullanır (saf HMAC). Webhook secret
// ortam değişkeni testte set edilir.
import { verifyPaddleSignature } from "@/lib/paddle";

// Paddle webhook imza formatı: `ts=<epoch>;h1=<hex>`. Payload üzerinden
// HMAC-SHA256(secret, `${ts}:${payload}`) hex'i imzadır.
describe("verifyPaddleSignature", () => {
  const secret = "test_paddle_secret_123";
  const ts = "1700000000";
  const payload = JSON.stringify({ event_type: "subscription.activated" });

  beforeAll(() => {
    process.env.PADDLE_WEBHOOK_SECRET = secret;
  });

  it("accepts a valid signature", () => {
    const h1 = createHmac("sha256", secret).update(`${ts}:${payload}`).digest("hex");
    expect(verifyPaddleSignature(payload, `ts=${ts};h1=${h1}`)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(verifyPaddleSignature(payload, `ts=${ts};h1=0000000000000000000000000000000000000000000000000000000000000000`)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyPaddleSignature(payload, "not-a-signature")).toBe(false);
    expect(verifyPaddleSignature(payload, "")).toBe(false);
  });
});
