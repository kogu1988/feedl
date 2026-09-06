import { describe, expect, it } from "vitest";

// Sprint 63i (test derinleştirme) — Paddle plan türetme + limitler (saf).
import { derivePlanFromStatus, PLANS, planFromString } from "@/lib/paddle";

describe("planFromString", () => {
  it("mapbı 'pro' to pro", () => {
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
});
