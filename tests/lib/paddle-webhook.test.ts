import { createHmac } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";

// Debug/regresyon kilidi: prod'daki webhook yolu `verifyPaddleWebhook` (SDK
// `isSignatureValid` + LENIENT parse). SDK `unmarshal`'ın STRICT event
// constructor'ları geçerli payload'ları `.map` hatasıyla reddedebiliyordu
// (canlıda yaşandı) — bu yüzden doğrulama + manuel parse ayrıldı. Test,
// minimal/eksik-alanlı ama imzası GEÇERLİ bir payload'ın yine de parse
// edildiğini ispatlar (lenient davranış regresyona kapanır). SDK'nın
// isSignatureValid'i OFFLINE HMAC + 5s timestamp toleransıdır (API çağrısı yok).
import { verifyPaddleWebhook } from "@/lib/paddle";

const secret = "test_paddle_secret_456";
const fakeApiKey = "pdl_live_fake_api_key_for_offline_hmac";

function makeSignature(raw: string): string {
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

beforeAll(() => {
  process.env.PADDLE_WEBHOOK_SECRET = secret;
  process.env.PADDLE_API_KEY = fakeApiKey;
});

describe("verifyPaddleWebhook (live prod path)", () => {
  it("parses a real-shaped subscription.activated event", async () => {
    const body = JSON.stringify({
      event_id: "evt_1",
      event_type: "subscription.activated",
      occurrence_at: new Date().toISOString(),
      data: { id: "sub_1", status: "active", customer_id: "ctm_1" },
    });
    const v = await verifyPaddleWebhook(body, makeSignature(body));
    expect(v).not.toBeNull();
    expect(v?.eventType).toBe("subscription.activated");
    expect(v?.data?.status).toBe("active");
    expect(v?.data?.customer_id).toBe("ctm_1");
  });

  it("parses a MINIMAL payload the strict SDK unmarshal would reject (lenient)", async () => {
    // data.items yok / eksik — SDK `unmarshal` konstruktor'ları bunu `.map`
    // hatasıyla reddediyordu (canlı bug). verifyPaddleWebhook bunu KABUL eder.
    const body = JSON.stringify({
      event_id: "evt_min",
      event_type: "subscription.created",
      occurrence_at: new Date().toISOString(),
      data: { id: "sub_min" },
    });
    const v = await verifyPaddleWebhook(body, makeSignature(body));
    expect(v).not.toBeNull();
    expect(v?.eventType).toBe("subscription.created");
    expect(v?.data?.id).toBe("sub_min");
  });

  it("returns null for an invalid signature", async () => {
    const body = JSON.stringify({ event_type: "subscription.canceled", data: {} });
    const bad = `ts=${Math.floor(Date.now() / 1000)};h1=${"0".repeat(64)}`;
    expect(await verifyPaddleWebhook(body, bad)).toBeNull();
  });

  it("returns null for a malformed/empty signature header", async () => {
    const body = JSON.stringify({ event_type: "subscription.canceled", data: {} });
    expect(await verifyPaddleWebhook(body, "")).toBeNull();
    expect(await verifyPaddleWebhook(body, "not-a-signature")).toBeNull();
  });

  it("returns null when there is no configured secret", async () => {
    const prev = process.env.PADDLE_WEBHOOK_SECRET;
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const body = JSON.stringify({ event_type: "subscription.canceled", data: {} });
    expect(await verifyPaddleWebhook(body, makeSignature(body))).toBeNull();
    process.env.PADDLE_WEBHOOK_SECRET = prev;
  });
});
