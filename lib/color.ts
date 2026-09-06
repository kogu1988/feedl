// Tek kaynak: marka rengi üzerinde okunabilir yazı rengi (WCAG 2.x contrasт).
// site-header ve site-footer'daki kopyalanmış `textOn` burada birleşti
// (Sprint 63w, F1). Doğru sRGB göreli luminance + kontrast oranı: her zaman
// DAHA YÜKSEK kontrastlı yazı rengini seçer. Mercan (#ff5c35) → koyu mürekkep
// (5.9:1), koyu renkler → beyaz. Eski naive ortalama mercanda beyaz veriyordu
// (3.1:1, AA başarısız) — bu yüzden düzeltildi.

// sRGB kanal değerini lineer uzaya çevirir (WCAG formülü).
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Renkler; "#" ile veya olmadan 6 haneli hex kabul eder.
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  if (value.length !== 6) return 0.95; // geçersiz → açık varsay (koyu mürekkep)
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

const INK_LUM = relativeLuminance("#2b0e04"); // koyu mürekkep
const WHITE_LUM = 1;

export function textOn(hex: string): string {
  const L = relativeLuminance(hex);
  // İki seçenek arasında kontrast oranı yüksek olanı seç (WCAG (L1+0.05)/(L2+0.05)).
  const inkContrast = (L + 0.05) / (INK_LUM + 0.05);
  const whiteContrast = (WHITE_LUM + 0.05) / (L + 0.05);
  return inkContrast >= whiteContrast ? "#2b0e04" : "#ffffff";
}

// Yardımcı: renk açık mı? (kontrast kararında kullanılır.)
export function isLightColor(hex: string): boolean {
  return textOn(hex) === "#2b0e04";
}

// Hex (6 haneli, # ile veya olmadan) → [r,g,b] 0-255. Geçersizse null.
export function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

// Overlay renk: marka renginin şeffaf (soft/tint) varyantını döner.
// `alpha` 0-1. Geçersiz marka renginde null. (F3: --brand-soft / --brand-tint.)
export function brandOverlay(hex: string, alpha: number): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const a = Math.round(alpha * 255);
  return `rgba(${r} ${g} ${b} / ${a})`;
}
