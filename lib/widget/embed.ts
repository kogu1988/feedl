// Widget embed yapılandırmasının TEK kaynağı. Hem müşteriye gösterilen
// snippet (dashboard/widget → widget-setup) hem feedl'in KENDİ yüzeylerindeki
// self-embed (components/custom/feedl-widget-self-embed.tsx) aynı kuralları
// taşımalı; kural iki yere kopyalanırsa sessizce ayrışır.
//
// "use client" YOK ve "server-only" YOK: sunucu bileşenlerinden de, client
// bileşenlerinden de import edilebilir. (Client modülden düz VERİ import eden
// sunucu bileşeni değeri `undefined` görür — kural bu tuzağın dışında dursun.)

// ── Self-embed yüzey politikası (2026-09-12) ────────────────────────────────
//
// Widget feedl'in KENDİ host'unda yalnız bu yüzeylerde görünür. EXACT eşleşme
// bilinçli: yeni bir sayfa eklendiğinde widget kazara oraya bulaşmaz.
//
// `/portal` ve `/dashboard*` ASLA: portal zaten geri bildirim panosunun kendisi
// (widget koymak feedl-içinde-feedl iframe yaratır), dashboard ise operatör
// yüzeyi. Bu liste hem sunucu çözücüsünde hem client yaşam döngüsünde aynı
// kaynaktan okunur.
export const SELF_EMBED_PATHS = ["/", "/roadmap", "/changelog"] as const;

export function isSelfEmbedSurface(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (SELF_EMBED_PATHS as readonly string[]).includes(pathname);
}

// Sunucuda çözülen, client'a geçen self-embed yapılandırması. `null` = bu
// istekte widget gösterilmemeli (host kapısı ya da oturum kapısı tutmadı).
export interface FeedlSelfEmbedConfig {
  /** `/widget.js` tam URL'i (istek host'undan türetilir). */
  src: string;
  /** feedl taban URL'i (widget'ın iframe/API çağrıları için). */
  baseUrl: string;
  /** Hedef workspace slug'ı — sayfada görünen panonun AYNISI. */
  workspace: string;
  /** Pro + özel renk varsa hex; yoksa null (widget varsayılanı uygulanır). */
  accent: string | null;
  buttonText: string;
}

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
