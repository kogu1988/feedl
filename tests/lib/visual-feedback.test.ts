import { describe, expect, it } from "vitest";

// Faz 2 — görsel feedback girdi doğrulaması: pin konumu viewport yüzdesi
// (0-100), başlık/açıklama sınırları, opsiyonel bağlam + ekran görüntüsü.
import { visualFeedbackSchema } from "@/lib/validations/post";

const base = {
  title: "Mobilde buton yanlış yerde",
  description: "Checkout butonu mobilde ekranın dışına taşıyor.",
  pinX: 42.5,
  pinY: 88.1,
};

describe("visualFeedbackSchema", () => {
  it("accepts a valid visual feedback payload", () => {
    const parsed = visualFeedbackSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pinX).toBe(42.5);
      expect(parsed.data.pinY).toBe(88.1);
    }
  });

  it("accepts optional clientContext and screenshot", () => {
    const parsed = visualFeedbackSchema.safeParse({
      ...base,
      clientContext: { device: "mobile", viewportWidth: 390, viewportHeight: 844 },
      screenshot: "data:image/webp;base64,AAAA",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects pin percentages outside 0-100", () => {
    expect(visualFeedbackSchema.safeParse({ ...base, pinX: -1 }).success).toBe(false);
    expect(visualFeedbackSchema.safeParse({ ...base, pinY: 101 }).success).toBe(false);
  });

  it("rejects too-short title/description", () => {
    expect(visualFeedbackSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
    expect(visualFeedbackSchema.safeParse({ ...base, description: "xy" }).success).toBe(false);
  });

  it("rejects a non-numeric pin", () => {
    expect(visualFeedbackSchema.safeParse({ ...base, pinX: "42" }).success).toBe(false);
  });
});
