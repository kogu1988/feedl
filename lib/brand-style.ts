import { brandOverlay, hexToRgb, textOn } from "@/lib/color";

// 2026-09-12 (kullanıcı) — MARKA PALETİNİN TEK KAYNAĞI.
//
// Neden ayrı modül: bu stil daha önce yalnız `app/(main)/layout.tsx` içinde
// yerel bir fonksiyondu ve `:root`'a yazıldığı için TÜM (main) ağacını
// boyuyordu — yani bir workspace marka rengi seçtiğinde bizim DASHBOARD'umuz da
// onun rengine dönüyordu. Oysa müşteri rengi yalnız workspace'in DIŞARI AÇTIĞI
// yüzeylerde (portal, yol haritası, changelog, post detayı, widget, e-postalar)
// geçerli olmalı; dashboard feedl'in kendi ürün yüzeyidir ve feedl markasıyla
// kalır.

/** Feedl'in varsayılan marka rengi (mercan). */
export const FEEDL_BRAND_COLOR = "#ff5c35";

// Marka renginden türetilen CSS değişkenleri. `--primary` da markaya bağlanır
// (oy/buton/odak renkleri). Geçersiz/boş renkte boş dize döner.
export function brandStyleFor(color: string | null | undefined): string {
  const value = color?.trim().toLowerCase() ?? "";
  if (!value) return "";
  const rgb = hexToRgb(value);
  if (!rgb) return "";
  const [r, g, b] = rgb;
  const fg = textOn(value);
  const soft = brandOverlay(value, 0.14) ?? `rgba(${r} ${g} ${b} / 0.14)`;
  const tint = brandOverlay(value, 0.08) ?? `rgba(${r} ${g} ${b} / 0.08)`;
  const strong = `rgb(${Math.round(r * 0.72)} ${Math.round(g * 0.72)} ${Math.round(b * 0.72)})`;
  return `:root,.dark{--brand:${value};--brand-strong:${strong};--brand-soft:${soft};--brand-tint:${tint};--primary:${value};--primary-foreground:${fg};}`;
}

// Workspace'in dışarı açtığı yüzeyler için. Varsayılan renkte no-op (boş dize):
// gereksiz stil etiketi yazmayalım.
export function workspaceBrandStyle(color: string | null | undefined): string {
  const value = color?.trim().toLowerCase() ?? "";
  if (!value || value === FEEDL_BRAND_COLOR) return "";
  return brandStyleFor(value);
}

// FEEDL'e ait yüzeyler (dashboard ve ileride iç panel) için: üstteki workspace
// paletini feedl varsayılanına DÖNDÜRÜR. Her zaman yazılır — bir şeyi ezmesi
// gerektiği için no-op olamaz.
export function feedlBrandResetStyle(): string {
  return brandStyleFor(FEEDL_BRAND_COLOR);
}
