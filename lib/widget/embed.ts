// Widget embed yapılandırmasının TEK kaynağı. Hem müşteriye gösterilen
// snippet (dashboard/widget → widget-setup) hem feedl'in KENDİ yüzeylerindeki
// self-embed (components/custom/feedl-widget-script) aynı kuralları taşımalı;
// kural iki yere kopyalanırsa sessizce ayrışır.
//
// "use client" YOK ve "server-only" YOK: sunucu bileşenlerinden de, client
// bileşenlerinden de import edilebilir. (Client modülden düz VERİ import eden
// sunucu bileşeni değeri `undefined` görür — kural bu tuzağın dışında dursun.)

// Feedl marka aksanı (#ff5c35). Renk verilmediğinde widget'ın kendi
// varsayılanı da bu değerdir.
export const WIDGET_BRAND_ACCENT = "#ff5c35";

// Widget script'iyle aynı katı kabul (geçersiz değer sessizce varsayılana
// düşerdi; niteliği hiç yazmamak daha dürüst).
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/;

/**
 * `data-accent` niteliğine yazılacak rengi çözer; yazılMAMASI gereken hâlde
 * `null` döner.
 *
 * Plan matrisi: Free'de widget rengi SABİTTİR (feedl marka rengi) → nitelik
 * hiç yazılmaz, widget varsayılanı uygulanır. Özel renk Pro'ya aittir; Pro'da
 * renk marka rengine eşitse yine yazılmaz (gereksiz nitelik olurdu).
 */
export function resolveWidgetAccent(
  isPro: boolean,
  brandColor: string | null | undefined,
): string | null {
  const value = (brandColor ?? "").trim().toLowerCase();
  if (!isPro) return null;
  if (!HEX_RE.test(value)) return null;
  if (value === WIDGET_BRAND_ACCENT) return null;
  return value;
}
