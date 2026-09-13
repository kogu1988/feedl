import { afterEach, describe, expect, it, vi } from "vitest";

import { getPriceDisplay } from "@/components/custom/plan-config";

// Sprint 69.2 — TR-first fiyat gösterimi.
//
// Neden test: TRY, env ile açılan bir özelliktir ve YANLIŞ yapılandırma
// (kısmi değerler, yanlış bayrak) kullanıcıya karışık/boş fiyat gösterme
// riski taşır. Kural: üç TRY değeri de yoksa sessizce USD'ye düş — uydurma
// veya kırık fiyat ASLA gösterilmez.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPriceDisplay — TR-first", () => {
  it("yapılandırma yoksa USD döner (varsayılan)", () => {
    const d = getPriceDisplay();
    expect(d.currency).toBe("USD");
    expect(d.monthly).toMatch(/\$/);
    expect(d.yearlyTotal).toMatch(/\$/);
  });

  it("TRY bayrağı + ÜÇ değer varsa TL gösterir", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICE_CURRENCY", "TRY");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_MONTHLY", "749");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_YEARLY_MONTHLY", "590");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_YEARLY_TOTAL", "7080");
    const d = getPriceDisplay();
    expect(d.currency).toBe("TRY");
    expect(d.monthly).toBe("₺749");
    expect(d.yearlyTotal).toBe("₺7080");
  });

  it("KISMİ TRY yapılandırmasında USD'ye düşer (karışık para birimi göstermez)", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICE_CURRENCY", "TRY");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_MONTHLY", "749");
    // yearlyMonthly / yearlyTotal YOK
    const d = getPriceDisplay();
    expect(d.currency).toBe("USD");
  });

  it("bayrak TRY değilse TRY değerleri olsa bile USD gösterir", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_MONTHLY", "749");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_YEARLY_MONTHLY", "590");
    vi.stubEnv("NEXT_PUBLIC_PRICE_TRY_YEARLY_TOTAL", "7080");
    expect(getPriceDisplay().currency).toBe("USD");
  });
});
