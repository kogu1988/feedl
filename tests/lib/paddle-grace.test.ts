import { describe, expect, it } from "vitest";

import {
  DUNNING_GRACE_DAYS,
  effectivePlanKey,
  isDunningStatus,
} from "@/lib/paddle";

// 2026-09-12 (denetim K3) — dunning grace.
//
// Önceden `derivePlanFromStatus` `past_due`/`dunned` durumlarını ANINDA `free`
// yapıyordu: kartı geçmeyen müşteri, Paddle daha yeniden denemeye fırsat
// bulamadan Pro'yu kaybediyordu (entegrasyonlar durur, custom domain düşer,
// private board'lar görünmez olur). Bu testler grace penceresini ve onun
// OKUMA ANINDA hesaplandığını (cron'a bağımlı olmadan) kilitler.
describe("effectivePlanKey (dunning grace)", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  it("saklanan plan pro ise her zaman pro (grace'e bakılmaz)", () => {
    expect(effectivePlanKey({ plan: "pro" }, now)).toBe("pro");
    expect(
      effectivePlanKey(
        {
          plan: "pro",
          paddleSubscriptionStatus: "past_due",
          paddleStatusChangedAt: daysAgo(30),
        },
        now,
      ),
    ).toBe("pro");
  });

  it("ödeme sorunu grace penceresi İÇİNDEyse pro kalır", () => {
    expect(
      effectivePlanKey(
        {
          plan: "free",
          paddleSubscriptionStatus: "past_due",
          paddleStatusChangedAt: daysAgo(1),
        },
        now,
      ),
    ).toBe("pro");
    expect(
      effectivePlanKey(
        {
          plan: "free",
          paddleSubscriptionStatus: "dunned",
          paddleStatusChangedAt: daysAgo(DUNNING_GRACE_DAYS - 1),
        },
        now,
      ),
    ).toBe("pro");
  });

  it("grace dolduğunda free'ye düşer (webhook beklemeden)", () => {
    expect(
      effectivePlanKey(
        {
          plan: "free",
          paddleSubscriptionStatus: "past_due",
          paddleStatusChangedAt: daysAgo(DUNNING_GRACE_DAYS + 1),
        },
        now,
      ),
    ).toBe("free");
  });

  it("grace dışı sonlandırıcı statüler beklemeden free", () => {
    for (const status of ["canceled", "paused", "expired"]) {
      expect(
        effectivePlanKey(
          {
            plan: "free",
            paddleSubscriptionStatus: status,
            paddleStatusChangedAt: daysAgo(0),
          },
          now,
        ),
        status,
      ).toBe("free");
    }
  });

  it("zaman damgası yoksa/geçersizse güvenli taraf: free", () => {
    expect(
      effectivePlanKey({ plan: "free", paddleSubscriptionStatus: "past_due" }, now),
    ).toBe("free");
    expect(
      effectivePlanKey(
        {
          plan: "free",
          paddleSubscriptionStatus: "past_due",
          paddleStatusChangedAt: "bozuk-tarih",
        },
        now,
      ),
    ).toBe("free");
  });

  it("isDunningStatus yalnız ödeme sorununu kapsar", () => {
    expect(isDunningStatus("past_due")).toBe(true);
    expect(isDunningStatus("dunned")).toBe(true);
    for (const status of ["canceled", "paused", "expired", "active", "trialing", null, undefined]) {
      expect(isDunningStatus(status), String(status)).toBe(false);
    }
  });
});
