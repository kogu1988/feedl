import { describe, expect, it } from "vitest";

// P0/a11y: tasarım kanonunun kritik renk kararları WCAG AA'yı sağlıyor mu?
// DESIGN.md §1/§2 — mercan üzerine BEYAZ DEĞİL koyu mürekkep (#2b0e04),
// `--primary-foreground` sabit; `brand-strong` açık zeminde tema. Değerler
// hex olduğundan `contrastRatio` ile SAF olarak doğrulanır.
import { contrastRatio, textOn } from "@/lib/color";

describe("brand color contrast (WCAG AA)", () => {
  it("ink-on-coral passes AA for normal text (>=4.5:1)", () => {
    const ratio = contrastRatio("#2b0e04", "#ff5c35");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("picks dark ink, not white, for the coral accent (the canon rule)", () => {
    expect(textOn("#ff5c35")).toBe("#2b0e04");
  });

  it("brand-strong (#c7360f) on a light surface passes AA", () => {
    const ratio = contrastRatio("#c7360f", "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on coral fails AA (why the canon bans white-on-coral)", () => {
    // Bu, kanonun neden beyaz KULLANDIĞINI doğrular — aksine bir regresyon
    // (beyaza dönme) AA'yı bozar ve bu test bunu yakalar.
    const ratio = contrastRatio("#ffffff", "#ff5c35");
    expect(ratio).toBeLessThan(4.5);
  });

  it("dark ink on white passes (default text on light background)", () => {
    expect(contrastRatio("#1f2937", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
