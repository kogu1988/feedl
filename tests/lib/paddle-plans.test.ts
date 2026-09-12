import { describe, expect, it } from "vitest";

// Sprint 63i (test derinleştirme) — Paddle plan türetme + limitler (saf).
import {
  derivePlanFromStatus,
  paddleWebhookDataSchema,
  PLANS,
  planFromString,
} from "@/lib/paddle";

describe("planFromString", () => {
  it("maps 'pro' to pro", () => {
    expect(planFromString("pro")).toBe("pro");
  });

  it("maps free / null / undefined / unknown to free", () => {
    expect(planFromString("free")).toBe("free");
    expect(planFromString(null)).toBe("free");
    expect(planFromString(undefined)).toBe("free");
    expect(planFromString("enterprise")).toBe("free");
    expect(planFromString("")).toBe("free");
  });
});

describe("PLANS", () => {
  it("free plan has bounded limits", () => {
    expect(PLANS.free.trackedUserLimit).toBe(50);
    expect(PLANS.free.boardLimit).toBe(1);
    expect(PLANS.free.memberLimit).toBe(1);
  });

  it("pro plan removes board/tracked limits and caps members", () => {
    expect(PLANS.pro.memberLimit).toBe(10);
    expect(PLANS.pro.boardLimit).toBe(Number.MAX_SAFE_INTEGER);
    expect(PLANS.pro.trackedUserLimit).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("derivePlanFromStatus", () => {
  it("maps active and trialing to pro", () => {
    expect(derivePlanFromStatus("active")).toBe("pro");
    expect(derivePlanFromStatus("trialing")).toBe("pro");
  });

  it("maps canceled/paused/past_due/dunned/expired to free", () => {
    for (const s of ["canceled", "paused", "past_due", "dunned", "expired"]) {
      expect(derivePlanFromStatus(s)).toBe("free");
    }
  });

  it("returns null for unknown/empty/null statuses (ignored events)", () => {
    expect(derivePlanFromStatus("unknown")).toBeNull();
    expect(derivePlanFromStatus("")).toBeNull();
    expect(derivePlanFromStatus(null)).toBeNull();
    expect(derivePlanFromStatus(undefined)).toBeNull();
  });

  // P0-3 (billing lifecycle): plan YALNIZCA fiili `status`'la derlenir.
  // Kişi bir `subscription.updated` ile `scheduled_change` (iptal/pause)
  // planlamış olsa bile, durum hâlâ active/trialing ise erişim KESİLMEZ.
  // Webhook `scheduled_change`'i yalnızca `scheduled_change_*` alanlarına
  // yazar; plan kararına şu fonksiyon girer ve `scheduled_change`'i bilmez.
  it("does not revoke when a scheduled change exists but status is active", () => {
    // Aynı fonksiyon, scheduled_change girişleriyle veya olmadan aynı sonucu verir
    // (imza scheduled_change'i almadığı için) — bu, iptal planlamanın erişimi
    // kesmediğini belgeler.
    expect(derivePlanFromStatus("active")).toBe("pro");
    expect(derivePlanFromStatus("trialing")).toBe("pro");
  });

  // P0-3: gerçek `canceled`/`past_due`/`paused` durumu erişimi KESER.
  it("revokes only on the actual terminal/blocking status", () => {
    expect(derivePlanFromStatus("canceled")).toBe("free");
    expect(derivePlanFromStatus("paused")).toBe("free");
    expect(derivePlanFromStatus("past_due")).toBe("free");
    expect(derivePlanFromStatus("dunned")).toBe("free");
    expect(derivePlanFromStatus("expired")).toBe("free");
  });
});

describe("paddleWebhookDataSchema (2026-09-12 incelemesi)", () => {
  // EN ÖNEMLİ özellik: parse ASLA patlamaz. Webhook'un reddedilmesi plan
  // senkronunu durdurur (billing'in kritik yolu), bu yüzden şema katı değil —
  // her yaprak `.catch(undefined)` taşır.
  it("çöp/eksik payload'da patlamaz", () => {
    const garbage = [
      {},
      { id: 123, status: null, items: "nope" },
      { customer: [], custom_data: 5, items: [{ price: { id: 7 } }] },
    ];
    for (const payload of garbage) {
      expect(paddleWebhookDataSchema.safeParse(payload).success).toBe(true);
    }
  });

  it("beklenen alanları tipli çıkarır", () => {
    const parsed = paddleWebhookDataSchema.parse({
      id: "sub_1",
      status: "active",
      customer: { id: "ctm_1", email: "a@b.c" },
      items: [{ price: { id: "pri_1", product_id: "pro_1" } }],
      custom_data: { slug: "acme", workspace_id: "ws-1" },
      scheduled_change: { action: "cancel", effective_at: "2026-10-01T00:00:00Z" },
    });
    expect(parsed.id).toBe("sub_1");
    expect(parsed.customer?.email).toBe("a@b.c");
    expect(parsed.items?.[0]?.price?.id).toBe("pri_1");
    expect(parsed.custom_data?.workspace_id).toBe("ws-1");
    expect(parsed.scheduled_change?.effective_at).toBe("2026-10-01T00:00:00Z");
  });

  it("yanlış tipli alanı undefined yapar (parse yine başarılı)", () => {
    const parsed = paddleWebhookDataSchema.parse({
      status: 42,
      items: [{ price: "x" }],
    });
    expect(parsed.status).toBeUndefined();
    expect(parsed.items?.[0]?.price).toBeUndefined();
  });
});
