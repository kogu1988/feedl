/*!
 * feedl widget embed script (plan.md Sprint 32)
 *
 * Kullanım (müşteri sitesi):
 *   <script
 *     src="https://getfeedl.vercel.app/widget.js"
 *     data-feedl-url="https://getfeedl.vercel.app"
 *     data-token="<1 saatlik HS256 widget JWT — opsiyonel>"
 *     data-button-text="Geri bildirim"
 *   ></script>
 *
 * - data-token verilirse açılışta /api/widget/session çağrılır; başarılıysa
 *   iframe içindeki fikir gönderme/oylama aktifleşir (kimlik feedl'in
 *   httpOnly widget çerezinde taşınır).
 * - iframe /widget sayfasını açar; postMessage köprüsü feedl origin'inden
 *   gelen "feedl:close" mesajıyla paneli kapatır.
 */
(function () {
  "use strict";

  if (window.__feedlWidgetLoaded) return;
  window.__feedlWidgetLoaded = true;

  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  function attr(name) {
    return currentScript && currentScript.getAttribute
      ? currentScript.getAttribute(name)
      : null;
  }

  var globalCfg = window.feedlWidget || {};

  var baseUrl = (attr("data-feedl-url") || globalCfg.url || "").replace(/\/$/, "");
  if (!baseUrl && currentScript && currentScript.src) {
    try {
      baseUrl = new URL(currentScript.src).origin;
    } catch (e) {
      baseUrl = "";
    }
  }
  if (!baseUrl) {
    if (window.console && console.error) {
      console.error("[feedl] widget URL bulunamadı: data-feedl-url ekleyin.");
    }
    return;
  }

  var feedlOrigin;
  try {
    feedlOrigin = new URL(baseUrl).origin;
  } catch (e) {
    return;
  }

  var token = attr("data-token") || globalCfg.token || null;
  var buttonText = attr("data-button-text") || globalCfg.buttonText || "Geri bildirim";

  // Kimlik: müşteri uygulaması ürettiği kısa ömürlü jetonu session
  // ucuna gönderir; feedl httpOnly SameSite=None çerez bırakır. Çağrı
  // parent siteden cross-origin olduğu için CORS başlıkları sunucuda
  // allowlist'e göre üretilir (app/api/widget/session).
  if (token) {
    try {
      fetch(baseUrl + "/api/widget/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token }),
      }).catch(function () {});
    } catch (e) {
      /* oturum açılamazsa widget salt-okunur listeyle açılır */
    }
  }

  var CSS = [
    ".feedl-widget-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;",
    "display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:9999px;",
    "background:#111827;color:#fff;font:600 14px/1 system-ui,-apple-system,sans-serif;cursor:pointer;",
    "box-shadow:0 10px 25px rgba(0,0,0,.2)}",
    ".feedl-widget-launcher:hover{transform:translateY(-1px)}",
    ".feedl-widget-launcher svg{width:18px;height:18px;flex:none}",
    ".feedl-widget-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.4);",
    "display:flex;align-items:flex-end;justify-content:flex-end;padding:20px}",
    ".feedl-widget-overlay[hidden]{display:none}",
    ".feedl-widget-panel{position:relative;width:min(420px,calc(100vw - 24px));",
    "height:min(600px,calc(100vh - 24px));border-radius:16px;background:#fff;overflow:hidden;",
    "box-shadow:0 25px 60px rgba(0,0,0,.3)}",
    ".feedl-widget-close{position:absolute;top:8px;right:8px;z-index:1;width:28px;height:28px;",
    "display:flex;align-items:center;justify-content:center;border:0;border-radius:9999px;",
    "background:rgba(255,255,255,.9);color:#374151;font-size:16px;line-height:1;cursor:pointer;",
    "box-shadow:0 1px 4px rgba(0,0,0,.15)}",
    ".feedl-widget-close:hover{background:#fff}",
    ".feedl-widget-iframe{width:100%;height:100%;border:0;display:block}",
    "@media (max-width:480px){.feedl-widget-launcher{right:12px;bottom:12px}",
    ".feedl-widget-overlay{padding:0}.feedl-widget-panel{width:100vw;height:100vh;border-radius:0}}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "feedl-widget-launcher";
  launcher.setAttribute("aria-label", buttonText);
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg><span></span>';
  launcher.lastChild.textContent = buttonText;

  var overlay = document.createElement("div");
  overlay.className = "feedl-widget-overlay";
  overlay.hidden = true;

  var panel = document.createElement("div");
  panel.className = "feedl-widget-panel";

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "feedl-widget-close";
  closeBtn.setAttribute("aria-label", "Kapat");
  closeBtn.innerHTML = "&#10005;";

  var iframe = document.createElement("iframe");
  iframe.className = "feedl-widget-iframe";
  iframe.title = buttonText;
  iframe.src = baseUrl + "/widget";

  panel.appendChild(closeBtn);
  panel.appendChild(iframe);
  overlay.appendChild(panel);
  document.body.appendChild(launcher);
  document.body.appendChild(overlay);

  function openWidget() {
    overlay.hidden = false;
  }

  function closeWidget() {
    overlay.hidden = true;
  }

  launcher.addEventListener("click", openWidget);
  closeBtn.addEventListener("click", closeWidget);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeWidget();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) closeWidget();
  });

  // iframe içi sayfa "feedl:close" gönderirse paneli kapat (yalnızca
  // feedl origin'inden gelen mesajlar kabul edilir).
  window.addEventListener("message", function (event) {
    if (event.origin !== feedlOrigin) return;
    if (event.data && event.data.type === "feedl:close") closeWidget();
  });
})();
