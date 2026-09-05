// @feedl/widget — tip tanımları (hand-authored; derlenmez, doğrudan yayınlanır).

/** Widget görünüm/panel teması. */
export type FeedlWidgetTheme = "light" | "dark" | "auto";

/** init() seçenekleri — `data-*` öznitelikleriyle birebir eşleşir. */
export interface FeedlWidgetOptions {
  /**
   * feedl taban URL'si (widget.js'in yüklendiği origin).
   * Varsayılan: "https://feedl.app".
   */
  url?: string;

  /**
   * widget.js betiğinin tam URL'si (özelleştirme; varsayılan `url + "/widget.js"`).
   */
  scriptUrl?: string;

  /**
   * 1 saatlik HS256 widget JWT — opsiyonel. Verilirse oturum açılır; fikir
   * gönderme + oylama aktifleşir, yoksa widget salt-okunur liste kalır.
   */
  token?: string;

  /** Launcher buton metni. Varsayılan: "Geri bildirim". */
  buttonText?: string;

  /** Launcher arka plan rengi (hex; yazı rengi kontrasta göre otomatik). */
  accent?: string;

  /** Panel + iframe teması. Varsayılan: "light". */
  theme?: FeedlWidgetTheme;
}

/** `window.feedlWidget` — widget.js'in global API'si. */
export interface FeedlWidgetAPI {
  /**
   * Kullanıcı girişi/session sonrası yeni kısa ömürlü jetonla kimliği yenile
   * (Canny `identify` karşılığı). Token yoksa widget salt-okunur kalır.
   */
  identify(options: { token?: string; jwt?: string; value?: string }): void;
}

/** `window.feedlWidget`'a erişim (genel tip genişletmesi). */
declare global {
  interface Window {
    feedlWidget?: FeedlWidgetAPI;
    __feedlWidgetIdentifyQueue?: string[];
  }
}

/**
 * Widget'ı başlat — `widget.js`'i enjekte eder (idempotent). Dönen API,
 * widget.js henüz yüklenmediyse `identify` çağrısını kuyruğa alan bir sürüm.
 */
export function init(options?: FeedlWidgetOptions): FeedlWidgetAPI | null;

/**
 * Kullanıcı girişi sonrası yeni jetonla kimliği yenile. widget.js henüz
 * yüklenmediyse jeton kuyruğa alınır ve yüklenince yeniden oynatılır.
 */
export function identify(options: { token?: string }): void;
