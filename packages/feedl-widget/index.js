/**
 * @feedl/widget — feedl geri bildirim widget'ı için resmi npm yükleyici.
 *
 * Bu paket, feedl'in sunduğu <script> embed'ini (feedl.app/widget.js) enjekte
 * eden ince, tipli bir sarmalayıcıdır. Widget mantığı sunucuda tek yerde yaşar
 * (widget.js) — burada tekrarlanmaz; paket yalnızca script'i yükler ve
 * `feedlWidget.identify()` gibi API'leri tipli şekilde sunar.
 *
 * Kullanım (ESM / bundler):
 *   import { init, identify } from "@feedl/widget";
 *   init({ url: "https://feedl.app", token: "<jwt>", buttonText: "Geri bildirim" });
 *   // kullanıcı girişi sonrası yeni kimlik:
 *   identify({ token: "<yeni-jwt>" });
 *
 * `<script type="module">` (tarayıcıda, bundler'sız):
 *   import { init } from "https://feedl.app/@feedl/widget/index.js";
 *   init({ url: "https://feedl.app", buttonText: "Geri bildirim" });
 */

/** @typedef {import("./index.d.ts").FeedlWidgetOptions} FeedlWidgetOptions */
/** @typedef {import("./index.d.ts").FeedlWidgetAPI} FeedlWidgetAPI */

var FEEDL_WIDGET_SRC_ATTR = "data-feedl-url";
var FEEDL_WIDGET_TOKEN_ATTR = "data-token";
var FEEDL_WIDGET_BUTTON_ATTR = "data-button-text";
var FEEDL_WIDGET_ACCENT_ATTR = "data-accent";
var FEEDL_WIDGET_THEME_ATTR = "data-theme";

function removeTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

/**
 * widget.js'i (müşterinin feedl URL'sinden veya varsayılan feedl.app'ten)
 * enjekte eder. Nötr (idempotent): aynı src'ten tekrar çağrılırsa yeni script
 * eklemez. Dönen API: `feedlWidget.identify` vb.
 *
 * @param {FeedlWidgetOptions} [options]
 * @returns {FeedlWidgetAPI | null} — window.feedlWidget (yüklenince); yoksa
 *   identify() beklemede kalan sürüm döner.
 */
export function init(options) {
  options = options || {};

  var url = removeTrailingSlash(options.url || "https://feedl.app");
  var scriptUrl = removeTrailingSlash(options.scriptUrl || url + "/widget.js");

  // Zaten yüklü mü? (aynı src'ten) — mükerrer enjeksiyon önlenir.
  var existing = document.querySelector(
    'script[feedl-src="' + scriptUrl.replace(/"/g, "") + '"]',
  );
  if (!existing) {
    var script = document.createElement("script");
    script.setAttribute(FEEDL_WIDGET_SRC_ATTR, "true");
    script.setAttribute("feedl-src", scriptUrl);
    script.src = scriptUrl;
    script.async = true;

    script.setAttribute(FEEDL_WIDGET_SRC_ATTR, url);
    if (options.token) script.setAttribute(FEEDL_WIDGET_TOKEN_ATTR, options.token);
    if (options.buttonText) script.setAttribute(FEEDL_WIDGET_BUTTON_ATTR, options.buttonText);
    if (options.accent) script.setAttribute(FEEDL_WIDGET_ACCENT_ATTR, options.accent);
    if (options.theme) script.setAttribute(FEEDL_WIDGET_THEME_ATTR, options.theme);

    var holder =
      typeof document.head.appendChild === "function"
        ? document.head
        : document.body;
    holder.appendChild(script);
  }

  return window.feedlWidget || toApi();
}

/**
 * Kullanıcı girişi/session sonrası yeni kısa ömürlü jeton ile widget kimliğini
 * yenile. widget.js henüz yüklenmediyse options.token tarayıcıya yansıtılmaz;
 * bu yüzden yüklenince identify() çağırır (queue).
 *
 * @param {{ token?: string }} [options]
 * @returns {void}
 */
export function identify(options) {
  options = options || {};
  var token = options.token;
  if (!token) return;

  if (window.feedlWidget && typeof window.feedlWidget.identify === "function") {
    window.feedlWidget.identify({ token: token });
  } else {
    // Henüz yüklenmedi — init() sonrası çalışacakları sıraya al.
    window.__feedlWidgetIdentifyQueue = window.__feedlWidgetIdentifyQueue || [];
    window.__feedlWidgetIdentifyQueue.push(token);
  }
}

/** `window.feedlWidget` yokken init()'in döndürebileceği bekleme API'si. */
function toApi() {
  return {
    identify: function (payload) {
      identify(payload || {});
    },
  };
}
