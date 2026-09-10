// Faz 1 (visual-feedback öncesi) — geri bildirimle birlikte OTOMATİK teknik
// bağlam: cihaz türü, viewport, tarayıcı, işletim sistemi, sayfa URL'i. Amaç:
// AI triage'a yalnız kullanıcı metnini değil "kanıt + bağlam" vermek ve
// admin'in cihaza göre filtreleyebilmesi. Saf fonksiyonlar test edilebilir;
// `collectClientContext()` yalnız tarayıcıda çalışır.

export type DeviceType = "desktop" | "tablet" | "mobile";

export interface ClientContext {
  device: DeviceType;
  viewportWidth: number | null;
  viewportHeight: number | null;
  browser: string | null;
  os: string | null;
  pageUrl: string | null;
}

// Cihaz türü: önce UA sinyali (daha güvenilir), sonra viewport genişliği.
// (iPad gibi geniş tabletlerde UA belirleyici; saf genişlik yanıltıcı olur.)
export function deriveDeviceType(
  userAgent: string,
  width: number | null,
): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) {
    return "mobile";
  }
  if (width != null) {
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
  }
  return "desktop";
}

// Tarayıcı adı (sürüm hariç, kısa): Edge > Opera > Chrome > Safari > Firefox.
// Sıra önemli: Chrome UA'sı Safari/Edge token'ları da içerir.
export function parseBrowser(userAgent: string): string | null {
  const ua = userAgent;
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return "Other";
}

// İşletim sistemi (kısa): iOS > Android > Windows > macOS > Linux.
export function parseOs(userAgent: string): string | null {
  const ua = userAgent;
  if (!ua) return null;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

// Sunucu tarafı: istemciden gelen (opsiyonel) bağlamı, eksik alanlar için
// `user-agent` header'ından türeterek tamamlar. Route'lar bunu kullanır.
export function resolveClientContext(
  provided:
    | {
        device?: DeviceType;
        viewportWidth?: number | null;
        viewportHeight?: number | null;
        browser?: string | null;
        os?: string | null;
        pageUrl?: string | null;
      }
    | undefined,
  userAgent: string,
): ClientContext {
  const ua = userAgent ?? "";
  const width = provided?.viewportWidth ?? null;
  return {
    device: provided?.device ?? deriveDeviceType(ua, width),
    viewportWidth: width,
    viewportHeight: provided?.viewportHeight ?? null,
    browser: (provided?.browser ?? parseBrowser(ua)) || null,
    os: (provided?.os ?? parseOs(ua)) || null,
    pageUrl: provided?.pageUrl ?? null,
  };
}

// Tarayıcıda teknik bağlamı toplar. Widget iframe'inde viewport iframe
// boyutudur (host sayfa değil) — görsel-feedback fazında host script gerçek
// viewport'u sağlayacak. `pageUrl`: iframe'de `document.referrer` host sayfayı
// verir; portalda mevcut URL kullanılır.
export function collectClientContext(): ClientContext {
  if (typeof window === "undefined") {
    return { device: "desktop", viewportWidth: null, viewportHeight: null, browser: null, os: null, pageUrl: null };
  }
  const ua = navigator.userAgent ?? "";
  const width = typeof window.innerWidth === "number" ? window.innerWidth : null;
  const height = typeof window.innerHeight === "number" ? window.innerHeight : null;
  const referrer = typeof document !== "undefined" ? document.referrer : "";
  const pageUrl = referrer || (typeof window.location !== "undefined" ? window.location.href : "");
  return {
    device: deriveDeviceType(ua, width),
    viewportWidth: width,
    viewportHeight: height,
    browser: parseBrowser(ua),
    os: parseOs(ua),
    pageUrl: pageUrl ? pageUrl.slice(0, 1000) : null,
  };
}
