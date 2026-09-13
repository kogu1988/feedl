import { describe, expect, it, vi } from "vitest";

import { ANALYTICS_EVENTS } from "@/lib/analytics/names";
import { __sanitizeProps, trackEvent } from "@/lib/analytics/events";

// Sprint 65 — ürün analitiği çekirdek kuralları.
//
// Neden önemli: huni olayları ürün kararlarının tek ölçüm kaynağı olacak.
// Yanlış yazılmış bir olay adı sessizce kaybolur; PII sızıntısı ise bir kez
// olduğunda gizlilik politikasını ihlal eder. İkisi de testle kilitlenir.

describe("ANALYTICS_EVENTS taksonomisi", () => {
  it("tekildir (duplike ad huniyi böler)", () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });

  it("huninin çekirdek adımlarını içerir", () => {
    for (const name of [
      "signup",
      "workspace_created",
      "feedback_added",
      "customer_linked",
      "revenue_added",
      "priority_viewed",
      "upgrade_clicked",
    ]) {
      expect(ANALYTICS_EVENTS).toContain(name);
    }
  });
});

describe("sanitizeProps — PII savunması", () => {
  it("e-posta benzeri değerleri yazmadan önce ATAR", () => {
    const clean = __sanitizeProps({
      surface: "portal",
      email: "kullanici@example.com",
    });
    expect(clean).toEqual({ surface: "portal" });
    expect(JSON.stringify(clean)).not.toContain("@");
  });

  it("gizli alan adı e-posta içermese bile uzun serbest metni kırpar", () => {
    const long = "x".repeat(500);
    const clean = __sanitizeProps({ note: long });
    expect(clean?.note).toHaveLength(120);
  });

  it("sayı ve bool değerleri korur", () => {
    const clean = __sanitizeProps({ count: 3, has_mrr: true, surface: "billing" });
    expect(clean).toEqual({ count: 3, has_mrr: true, surface: "billing" });
  });

  it("tüm değerler elenirse null döner (boş obje yazılmaz)", () => {
    expect(__sanitizeProps({ email: "a@b.co" })).toBeNull();
    expect(__sanitizeProps(undefined)).toBeNull();
  });

  it("nesne/dizi değerleri sessizce atlar", () => {
    const clean = __sanitizeProps({
      surface: "portal",
      // @ts-expect-error — kasıtlı geçersiz tip (savunma katmanı testi)
      meta: { nested: true },
    });
    expect(clean).toEqual({ surface: "portal" });
  });
});

describe("trackEvent — ateşle-ve-unut", () => {
  it("istek/DB bağlamı yoksa FIRLATMAZ (analitik akışı kırmaz)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      trackEvent("feedback_added", { workspaceId: "x", userId: "u" }),
    ).not.toThrow();
    spy.mockRestore();
  });
});
