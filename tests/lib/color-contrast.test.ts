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

  // Design-critique fix: muted-foreground (oklch 0.45 ≈ #6b6b6b) küçük metin için
  // AA (≥4.5:1) — hem açık zemin hem brand-soft/muted zeminlerde. 0.556 yalnız
  // 3.2:1 veriyordu (başarısız); bu, token'ı geri koyulaştırma regresyonunu yakalar.
  it("muted-foreground passes AA on background and brand-soft (small text)", () => {
    expect(contrastRatio("#6b6b6b", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#6b6b6b", "#ffe8df")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#6b6b6b", "#f4f4f5")).toBeGreaterThanOrEqual(4.5);
  });

  it("old muted-foreground (0.556) would fail — guards against reverting", () => {
    expect(contrastRatio("#8f8f8f", "#ffffff")).toBeLessThan(4.5);
  });
});
