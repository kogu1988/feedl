import { describe, expect, it } from "vitest";

import {
  ACCOUNT_PRO_NOTE,
  PLAN_POSITIONING,
  TRIAL_VS_WITHDRAWAL_NOTE,
} from "@/lib/plan-copy";

// Sprint 69 — plan konumlandırma metinleri (tek kaynak).
//
// Neden test: bu sabitler LANDING ve /pricing tarafından OKUNUR; birinin
// boşalması sayfada sessizce boş bir cümle (`<!-- -->`) bırakır — bu repoda
// tam olarak bir kez yaşandı (client modülden veri importu). Ayrıca marka
// adı taşıyan karşılaştırma dili yasal risk olduğu için yasak.

describe("plan-copy — konumlandırma metinleri", () => {
  it("Free/Pro cümleleri boş değil ve birbirinden farklı", () => {
    expect(PLAN_POSITIONING.free.length).toBeGreaterThan(10);
    expect(PLAN_POSITIONING.pro.length).toBeGreaterThan(10);
    expect(PLAN_POSITIONING.free).not.toBe(PLAN_POSITIONING.pro);
  });

  it("hesap düzeyi Pro açıklaması var (Sprint 69.3)", () => {
    expect(ACCOUNT_PRO_NOTE).toMatch(/Pro/);
    expect(ACCOUNT_PRO_NOTE.length).toBeGreaterThan(20);
  });

  it("deneme ile cayma hakkı ayrımı açıkça yazılır (Sprint 69.4)", () => {
    expect(TRIAL_VS_WITHDRAWAL_NOTE).toMatch(/cayma/i);
  });

  it("rakip marka adı taşımaz (yasal hijyen)", () => {
    const all = [PLAN_POSITIONING.free, PLAN_POSITIONING.pro, ACCOUNT_PRO_NOTE, TRIAL_VS_WITHDRAWAL_NOTE].join(" ");
    expect(all.toLowerCase()).not.toMatch(/canny|featurebase|uservoice|fider/);
  });
});
