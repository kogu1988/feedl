/*!
 * feedl widget embed script (plan.md Sprint 32)
 *
 * Kullanım (müşteri sitesi):
 *   <script
 *     src="https://feedl.app/widget.js"
 *   data-feedl-url="https://feedl.app"
 *   data-feedl-workspace="<workspace slug>"
 *   data-token="<1 saatlik HS256 widget JWT — opsiyonel>"
 *   data-button-text="Geri bildirim"
 *   data-accent="#7f1d1d"
 *   data-mark-color="#f59e0b"
 *   data-theme="light"
 *   ></script>
 *
 * - data-feedl-workspace: bu widget'ın ait olduğu feedl workspace slug'ı
 *   (örn. "acme"). ZORUNLU değil; verilmezse varsayılan workspace kullanılır.
 *   Doğru ayarlanırsa widget'ın tüm verileri (fikir/oy) müşterinin kendi
 *   workspace'inde toplanır (Sprint 63p tenant-aware).
 * - data-accent: launcher butonunun arka plan rengi (yalnızca hex kabul;
 *   yazı rengi WCAG kontrastına göre otomatik seçilir). Verilmezse feedl
 *   marka rengi (#ff5c35) kullanılır — free planın varsayılanı budur; Pro
 *   planda özel renk bu attribute ile verilir.
 * - data-mark-color: görsel geri bildirimde pin'in ve ekran görüntüsüne
 *   eklenen vurgu halkasının rengi (yalnızca hex). Verilmezse vurgu rengi
 *   kullanılır. Sitenizin rengine göre görünürlüğü artırmak için ayarlanır.
 * - data-theme: panel ve iframe teması — light | dark | auto (varsayılan
 *   light; auto = ziyaretçinin işletim sistemi tercihini izler).
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
    } catch {
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
  } catch {
    return;
  }

  // Idempotans bayrağı, doğrulama GEÇTİKTEN sonra set edilir: eksik/geçersiz
  // yapılandırmayla çıkan bir çalıştırma (ör. `data-feedl-url` henüz gelmedi)
  // sonraki denemeleri kalıcı olarak engellemesin.
  window.__feedlWidgetLoaded = true;

  var token = attr("data-token") || globalCfg.token || null;
  var buttonText = attr("data-button-text") || globalCfg.buttonText || "Geri bildirim";
  // Sprint 63p: bu widget'ın ait olduğu workspace slug'ı (müşteri sitesinin
  // verisi bu workspace'te toplanır). Yalnızca `[a-z0-9-]` kabul edilir.
  var workspaceRaw = (attr("data-feedl-workspace") || globalCfg.workspace || "").trim();
  var workspace = /^[a-z0-9-]{1,120}$/i.test(workspaceRaw) ? workspaceRaw.toLowerCase() : null;

  // Görünüm: data-accent launcher arka plan rengi (yalnızca hex kabul;
  // geçersizse varsayılana düşer), data-theme panel + iframe teması.
  var themeRaw = (attr("data-theme") || globalCfg.theme || "light").toLowerCase();
  var themeParam = themeRaw === "dark" || themeRaw === "auto" ? themeRaw : "light";

  // Çözümlenmiş tema hem panel kromu hem launcher varsayılan rengi için
  // gerekir, bu yüzden medya sorgusu burada kurulur (aşağıda tekrar kurulmaz).
  var prefersDark = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  function isDarkResolved() {
    if (themeParam === "dark") return true;
    if (themeParam === "auto") return Boolean(prefersDark && prefersDark.matches);
    return false;
  }

  // Varsayılan launcher rengi = feedl marka rengi. FREE planlı workspace'ler
  // snippet'e `data-accent` yazmaz, dolayısıyla marka rengi uygulanır (plan
  // matrisi); Pro'da `data-accent` ile özelleştirilir ve bu varsayılan devre
  // dışı kalır. Marka rengi hem açık hem koyu zeminde görünür (ölçülen
  // kontrast 3.07:1 / 6.44:1) — eski nötr koyu varsayılan koyu sitelerde
  // sayfa zeminiyle karışıp görünmez oluyordu (~1.1:1).
  var ACCENT_DEFAULT = "#ff5c35";
  var ACCENT_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  var accentRaw = (attr("data-accent") || globalCfg.accent || "").trim();
  var accentExplicit = ACCENT_RE.test(accentRaw);
  var accent = accentExplicit ? accentRaw.toLowerCase() : ACCENT_DEFAULT;

  function hexChannels(h) {
    var v = h.slice(1);
    if (v.length === 3 || v.length === 4) {
      v = v.slice(0, 3).split("").map(function (c) { return c + c; }).join("");
    } else if (v.length === 8) {
      v = v.slice(0, 6);
    }
    var n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Launcher yazı rengi: beyaz ve siyah kontrast oranlarından büyüğü kazanır
  // (WCAG göreli parlaklık; örn. mercan gibi açık marka renklerinde siyah).
  function launcherTextColor(bg) {
    function lin(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var c = hexChannels(bg);
    var l = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#18181b";
  }
  var launcherColor = launcherTextColor(accent);

  // Faz 2: görsel feedback pin + vurgu halkası rengi. Varsayılan = vurgu rengi;
  // müşteri `data-mark-color` ile sitenin rengine göre görünür bir ton seçer
  // (ör. koyu sitede açık sarı). Yalnızca hex kabul edilir.
  var markRaw = (attr("data-mark-color") || globalCfg.markColor || "").trim();
  var markColor = ACCENT_RE.test(markRaw) ? markRaw.toLowerCase() : accent;
  var markChannels = hexChannels(markColor);
  var markFill =
    "rgba(" + markChannels[0] + "," + markChannels[1] + "," + markChannels[2] + ",0.22)";

  // Kimlik: müşteri uygulaması ürettiği kısa ömürlü jetonu session
  // ucuna gönderir; feedl httpOnly SameSite=None çerez bırakır. Çağrı
  // parent siteden cross-origin olduğu için CORS başlıkları sunucuda
  // allowlist'e göre üretilir (app/api/widget/session).
  function sendToken(nextToken) {
    if (!nextToken) return;
    try {
      fetch(baseUrl + "/api/widget/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: nextToken,
          ...(workspace ? { workspace: workspace } : {}),
        }),
      }).catch(function () {});
    } catch {
      /* oturum açılamazsa widget salt-okunur listeyle açılır */
    }
  }
  if (token) sendToken(token);

  // Sprint 48m — dinamik kimlik: kullanıcı girişi sonrası ya da veri-attr
  // dışında `feedlWidget.identify({ token })` çağrısıyla yeni bir kısa ömürlü
  // jeton verilirse oturum yeniden açılır. Bu, anonim değil gerçek müşteri
  // kimliği taşır; token yoksa widget salt-okunur kalır.
  var widgetApi = {
    identify: function (options) {
      if (!options || typeof options !== "object") return;
      var nextToken = options.token || options.jwt || options.value || null;
      if (nextToken) {
        token = nextToken;
        sendToken(nextToken);
      }
    },
  };
  if (!window.feedlWidget) window.feedlWidget = widgetApi;
  else {
    window.feedlWidget.identify = widgetApi.identify;
  }

  // @feedl/widget npm yükleyicisi, widget.js yüklenmeden önce identify
  // çağırırsa jetonları `__feedlWidgetIdentifyQueue`'da biriktirir; burada
  // yüklendiğinde yeniden oynatılır.
  var pending = window.__feedlWidgetIdentifyQueue;
  if (pending && pending.length) {
    window.__feedlWidgetIdentifyQueue = [];
    for (var i = 0; i < pending.length; i += 1) {
      widgetApi.identify({ token: pending[i] });
    }
  }

  var CSS = [
    ".feedl-widget-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;",
    "display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:9999px;",
    "font:600 14px/1 system-ui,-apple-system,sans-serif;cursor:pointer;",
    "box-shadow:0 10px 25px rgba(0,0,0,.2)}",
    ".feedl-widget-launcher:hover{transform:translateY(-1px)}",
    ".feedl-widget-launcher svg{width:18px;height:18px;flex:none}",
    ".feedl-widget-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.4);",
    "display:flex;align-items:flex-end;justify-content:flex-end;padding:20px}",
    ".feedl-widget-overlay[hidden]{display:none}",
    ".feedl-widget-panel{position:relative;width:min(420px,calc(100vw - 24px));",
    // Mobil tarayıcıda `100vh` adres çubuğunun arkasını da sayar → panel
    // ekrana sığmaz (alt içerik kesilir). `100dvh` görünür alanı kullanır;
    // desteklemeyen tarayıcılar için `100vh` fallback önce yazılır.
    "height:min(600px,calc(100vh - 24px));height:min(600px,calc(100dvh - 24px));",
    "border-radius:16px;background:#fff;overflow:hidden;",
    "box-shadow:0 25px 60px rgba(0,0,0,.3)}",
    ".feedl-widget-close{position:absolute;top:8px;right:8px;z-index:1;width:28px;height:28px;",
    "display:flex;align-items:center;justify-content:center;border:0;border-radius:9999px;",
    "background:rgba(255,255,255,.9);color:#374151;font-size:16px;line-height:1;cursor:pointer;",
    "box-shadow:0 1px 4px rgba(0,0,0,.15)}",
    ".feedl-widget-close:hover{background:#fff}",
    ".feedl-widget-iframe{width:100%;height:100%;border:0;display:block}",
    "@media (max-width:480px){.feedl-widget-launcher{right:12px;bottom:12px}",
    ".feedl-widget-overlay{padding:0}",
    ".feedl-widget-panel{width:100vw;height:100vh;height:100dvh;border-radius:0}}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Gövdeye bağlanma: hidrasyon yarışına karşı İKİ KATMANLI koruma ─────
  //
  // Next.js App Router'da root layout `<html>`/`<body>` render eder, yani React
  // `<body>`'yi hidrasyon sırasında sahiplenir. Widget düğümü o sırada body'de
  // olursa React onu "beklenmeyen çocuk" görür → #418 uyuşmazlık hatası → body
  // yeniden render edilir ve widget SİLİNİR. (Kanıt: ana JS chunk'ları
  // geciktirilip widget'ın önce bağlanması sağlanınca belirti birebir
  // üretiliyor — tools/prove-widget-race.mjs.)
  //
  //   1) BEKLEME: bağlanma `load` + boşta kalma anına ertelenir; ana JS
  //      chunk'ları `load`'dan önce çalışmış olur, hidrasyon bitmiş olur.
  //   2) GERİ BAĞLANMA: yine de silinirsek MutationObserver geri koyar.
  //
  // Not: script `<head>`'e konulduğunda (async embed) `document.body` henüz
  // yoktur; bekleyen düğümler body oluşunca bağlanır.
  var pendingMounts = [];
  var mountsFlushed = false;

  function appendPending() {
    if (!document.body) return;
    for (var i = 0; i < pendingMounts.length; i++) {
      if (!pendingMounts[i].isConnected) document.body.appendChild(pendingMounts[i]);
    }
  }

  function watchRemoval() {
    if (typeof MutationObserver === "undefined" || !document.body) return;
    new MutationObserver(function () {
      for (var i = 0; i < pendingMounts.length; i++) {
        if (!pendingMounts[i].isConnected) {
          appendPending();
          return;
        }
      }
    }).observe(document.body, { childList: true });
  }

  function flushMounts() {
    if (mountsFlushed || !document.body) return;
    mountsFlushed = true;
    appendPending();
    watchRemoval();
  }

  function mount(el) {
    pendingMounts.push(el);
    // Zaten bağlandıysak (ör. görsel feedback katmanı sonradan oluşturuldu)
    // doğrudan ekle; değilse sıraya al.
    if (mountsFlushed && !el.isConnected && document.body) {
      document.body.appendChild(el);
    }
  }

  (function scheduleMount() {
    function viaIdle() {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(flushMounts, { timeout: 1500 });
      } else {
        setTimeout(flushMounts, 0);
      }
    }
    function ready() {
      if (document.readyState === "complete") viaIdle();
      else window.addEventListener("load", viaIdle, { once: true });
      // Emniyet supabı: `load` takılırsa (asılı kaynak) widget sonsuza kadar
      // beklemesin. Erken bağlanma olursa 2. katman toparlar.
      setTimeout(flushMounts, 8000);
    }
    if (document.body) ready();
    else document.addEventListener("DOMContentLoaded", ready, { once: true });
  })();

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "feedl-widget-launcher";
  launcher.style.background = accent;
  launcher.style.color = launcherColor;
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
  // Sprint 63p: workspace slug'ı iframe URL'sine taşınır — widget sayfası
  // (app/widget/page.tsx) bunu okuyup getWorkspaceId yerine geçip yeniden
  // doğrular; ayrıca session çerezi de işin içinde olduğundan çift kaynak.
  var query = [];
  if (themeParam !== "light") query.push("theme=" + encodeURIComponent(themeParam));
  if (workspace) query.push("ws=" + encodeURIComponent(workspace));
  iframe.src = baseUrl + "/widget" + (query.length ? "?" + query.join("&") : "");

  panel.appendChild(closeBtn);
  panel.appendChild(iframe);
  overlay.appendChild(panel);
  mount(launcher);
  mount(overlay);

  // Panel, kapat butonu ve launcher çözümlenen temaya uyar (auto: işletim
  // sistemi tercihini izler, tercih değişirse anında güncellenir).
  function applyChrome() {
    var dark = isDarkResolved();
    panel.style.background = dark ? "#1c1c1c" : "#fff";
    closeBtn.style.background = dark ? "rgba(28,28,28,.9)" : "rgba(255,255,255,.9)";
    closeBtn.style.color = dark ? "#d4d4d4" : "#374151";
    launcher.style.background = accent;
    launcher.style.color = launcherColor;
  }
  if (themeParam === "auto" && prefersDark) {
    var onPrefChange = function () { applyChrome(); };
    if (prefersDark.addEventListener) {
      prefersDark.addEventListener("change", onPrefChange);
    } else if (prefersDark.addListener) {
      prefersDark.addListener(onPrefChange);
    }
  }
  applyChrome();

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

  // ---- Faz 2: görsel feedback (host sayfada pin + ekran görüntüsü) ----
  // Müşteri sitesinde bir noktayı işaret eder; otomatik bağlam + opsiyonel
  // ekran görüntüsü /api/widget/visual-feedback'e gönderilir. Ekran görüntüsü
  // için `html-to-image` yalnız gerektiğinde ve SELF-HOST olarak
  // (feedl.app/widget-capture.js) yüklenir — 3. taraf yok, ek CSP izni gerekmez;
  // yüklenemezse görüntüsüz gönderilir (özellik çalışmaya devam eder).
  var VISUAL_CSS = [
    ".feedl-vf-layer{position:fixed;inset:0;z-index:2147483002;cursor:crosshair;",
    "background:rgba(15,23,42,.08)}",
    ".feedl-vf-layer[hidden]{display:none}",
    ".feedl-vf-hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483004;",
    "background:#111827;color:#fff;font:600 13px/1.4 system-ui,-apple-system,sans-serif;",
    "padding:8px 14px;border-radius:9999px;box-shadow:0 8px 20px rgba(0,0,0,.3);max-width:90vw}",
    ".feedl-vf-pin{position:fixed;box-sizing:border-box;z-index:2147483003;width:18px;height:18px;margin:-9px 0 0 -9px;",
    "border-radius:9999px;background:" + markColor + ";border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4)}",
    // Ekran görüntüsüne GİREN işaret: geniş, açık renkli halka. absolute +
    // doküman koordinatı → tam-sayfa yakalamada doğru noktaya oturur.
    ".feedl-vf-mark{position:absolute;box-sizing:border-box;z-index:2147483003;width:96px;height:96px;margin:-48px 0 0 -48px;",
    "border-radius:9999px;border:4px solid " + markColor + ";background:" + markFill + ";",
    "box-shadow:0 0 0 2px rgba(255,255,255,.7)}",
    ".feedl-vf-form{position:fixed;z-index:2147483004;width:min(320px,calc(100vw - 24px));background:#fff;color:#111827;",
    "border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.35);padding:12px;font:13px/1.4 system-ui,-apple-system,sans-serif}",
    ".feedl-vf-form input,.feedl-vf-form textarea{width:100%;box-sizing:border-box;border:1px solid #d4d4d8;",
    "border-radius:8px;padding:7px 9px;font:13px/1.4 system-ui,-apple-system,sans-serif;margin-top:6px}",
    ".feedl-vf-form textarea{resize:vertical;min-height:56px}",
    ".feedl-vf-actions{display:flex;gap:8px;margin-top:10px}",
    ".feedl-vf-actions button{flex:1;border-radius:8px;padding:8px;font:600 13px/1 system-ui,-apple-system,sans-serif;cursor:pointer;border:0}",
    ".feedl-vf-send{background:" + accent + ";color:" + launcherColor + "}",
    ".feedl-vf-cancel{background:#f4f4f5;color:#374151}",
    ".feedl-vf-msg{margin-top:6px;font-size:12px;color:#b91c1c}",
    // Toast launcher'ın HEMEN üstünde belirir. Launcher: bottom 20px + 42px
    // yükseklik = 62px → 8px boşlukla bottom 70px. Mobilde launcher 12px'te.
    ".feedl-vf-toast{position:fixed;right:20px;bottom:70px;z-index:2147483005;",
    "max-width:min(340px,calc(100vw - 40px));background:#1f2937;color:#fff;",
    "font:600 13px/1.4 system-ui,-apple-system,sans-serif;padding:10px 14px;border-radius:10px;",
    "box-shadow:0 8px 20px rgba(0,0,0,.3);animation:feedl-vf-in .18s ease-out}",
    ".feedl-vf-toast-ok{background:#065f46}",
    ".feedl-vf-toast-error{background:#b91c1c}",
    "@keyframes feedl-vf-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    "@media (max-width:480px){.feedl-vf-toast{right:12px;bottom:62px}}"
  ].join("");
  var vfStyle = document.createElement("style");
  vfStyle.textContent = VISUAL_CSS;
  document.head.appendChild(vfStyle);

  var vfLayer = document.createElement("div");
  vfLayer.className = "feedl-vf-layer";
  vfLayer.hidden = true;
  var vfHint = document.createElement("div");
  vfHint.className = "feedl-vf-hint";
  vfHint.textContent = "Sorunlu noktayı tıkla — ekran görüntüsü ve bağlam otomatik eklenir.";
  mount(vfLayer);
  mount(vfHint);
  vfHint.hidden = true;

  var vfPin = null;
  var vfForm = null;
  var vfMark = null; // ekran görüntüsüne giren vurgu halkası
  var vfSending = false; // çift gönderimi engeller
  var vfShotLib = null; // html-to-image yüklendiyse global

  function vfLoadShotLib() {
    // Self-host: html-to-image feedl.app'ten servis edilir (public/widget-capture.js)
    // → müşteri sitesinde EK CSP İZNİ GEREKMEZ (feedl.app zaten script-src'te)
    // ve 3. taraf script yüklenmez. Yüklenemezse görüntüsüz gönderilir.
    if (vfShotLib || window.htmlToImage) {
      vfShotLib = vfShotLib || window.htmlToImage;
      return Promise.resolve(vfShotLib);
    }
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = baseUrl + "/widget-capture.js";
      s.onload = function () { vfShotLib = window.htmlToImage || null; resolve(vfShotLib); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  function vfCollectContext() {
    var ua = navigator.userAgent || "";
    var w = window.innerWidth || null;
    var h = window.innerHeight || null;
    var device = /ipad|tablet|(android(?!.*mobile))/i.test(ua)
      ? "tablet"
      : /mobi|iphone|ipod|android.*mobile/i.test(ua) || (w && w < 768)
        ? "mobile"
        : "desktop";
    var browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other";
    var os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
    return { device: device, viewportWidth: w, viewportHeight: h, browser: browser, os: os, pageUrl: String(location.href).slice(0, 1000) };
  }

  function vfCleanup() {
    vfLayer.hidden = true;
    vfHint.hidden = true;
    if (vfPin) { vfPin.remove(); vfPin = null; }
    if (vfForm) { vfForm.remove(); vfForm = null; }
    if (vfMark) { vfMark.remove(); vfMark = null; }
  }

  // Vurgu halkasını pin'in sayfa (doküman) koordinatına yerleştirir. Göreli
  // konumlandırma için offsetParent'ın doküman ofseti ölçülür — body'de
  // position:relative veya margin olsa bile işaret doğru noktaya oturur.
  function vfPlaceMark(clientX, clientY) {
    var m = document.createElement("div");
    m.className = "feedl-vf-mark";
    document.body.appendChild(m);
    var docLeft = clientX + (window.pageXOffset || 0);
    var docTop = clientY + (window.pageYOffset || 0);
    var baseLeft = 0;
    var baseTop = 0;
    var op = m.offsetParent;
    if (op) {
      var r = op.getBoundingClientRect();
      baseLeft = r.left + (window.pageXOffset || 0);
      baseTop = r.top + (window.pageYOffset || 0);
    }
    m.style.left = docLeft - baseLeft + "px";
    m.style.top = docTop - baseTop + "px";
    return m;
  }

  function vfScheduleToast(t, hold) {
    if (t.__feedlTimer) clearTimeout(t.__feedlTimer);
    t.__feedlTimer = setTimeout(function () { t.remove(); }, hold);
  }

  // Toast launcher'ın HEMEN üstünde belirir (konum CSS'te). Uzun `hold` ile
  // yapışkan kalır — sonuç gelince vfToastUpdate ile güncellenir.
  function vfToast(text, hold) {
    var t = document.createElement("div");
    t.className = "feedl-vf-toast";
    t.setAttribute("role", "status");
    t.textContent = text;
    document.body.appendChild(t);
    vfScheduleToast(t, hold || 2600);
    return t;
  }

  function vfToastUpdate(t, text, isError) {
    if (!t || !t.isConnected) return;
    t.textContent = text;
    // Nötr (gönderiliyor) → yeşil (başarı) / kırmızı (hata).
    t.className =
      "feedl-vf-toast " + (isError ? "feedl-vf-toast-error" : "feedl-vf-toast-ok");
    vfScheduleToast(t, isError ? 5000 : 2200);
  }

  function vfOpenForm(x, y) {
    vfForm = document.createElement("div");
    vfForm.className = "feedl-vf-form";
    var left = Math.min(Math.max(12, x + 14), window.innerWidth - 332);
    var top = Math.min(Math.max(12, y + 14), window.innerHeight - 220);
    vfForm.style.left = left + "px";
    vfForm.style.top = top + "px";
    vfForm.innerHTML =
      '<div style="font-weight:700">Burada ne var?</div>' +
      '<input data-vf="title" maxlength="140" placeholder="Kısa başlık (örn. Mobilde buton aşağıda)">' +
      '<textarea data-vf="desc" maxlength="2000" placeholder="Neyin yanlış olduğunu kısaca anlat"></textarea>' +
      '<div class="feedl-vf-actions"><button type="button" class="feedl-vf-cancel">İptal</button>' +
      '<button type="button" class="feedl-vf-send">Gönder</button></div>' +
      '<div class="feedl-vf-msg" hidden></div>';
    document.body.appendChild(vfForm);
    vfForm.querySelector(".feedl-vf-cancel").addEventListener("click", vfCleanup);
    vfForm.querySelector(".feedl-vf-send").addEventListener("click", function () { vfSubmit(x, y); });
    var input = vfForm.querySelector('[data-vf="title"]');
    if (input) input.focus();
  }

  function vfSubmit(x, y) {
    if (!vfForm || vfSending) return;
    var titleEl = vfForm.querySelector('[data-vf="title"]');
    var descEl = vfForm.querySelector('[data-vf="desc"]');
    var msgEl = vfForm.querySelector(".feedl-vf-msg");
    var title = (titleEl && titleEl.value ? titleEl.value : "").trim();
    var desc = (descEl && descEl.value ? descEl.value : "").trim();
    if (title.length < 3 || desc.length < 3) {
      if (msgEl) { msgEl.hidden = false; msgEl.textContent = "Başlık ve açıklama gerekli."; }
      return;
    }
    vfSending = true;

    var pinX = Math.round((x / Math.max(1, window.innerWidth)) * 1000) / 10;
    var pinY = Math.round((y / Math.max(1, window.innerHeight)) * 1000) / 10;
    var payload = {
      title: title, description: desc, pinX: pinX, pinY: pinY,
      clientContext: vfCollectContext(),
    };

    // 1) UI'ı HEMEN toparla: overlay/ipucu/form/pin kalkar → kullanıcı beklemez
    //    ve tekrar tıklayamaz (vfSending + öğeler DOM'dan çıktı). Pin yerine
    //    ekran görüntüsüne GİREN vurgu halkası konur.
    vfCleanup();
    vfMark = vfPlaceMark(x, y);

    // 2) Anında geri bildirim: toast launcher'ın hemen üstünde, yükleme metniyle.
    var toast = vfToast("Geri bildirimin gönderiliyor…", 60000);

    // 3) Ekran görüntüsü (vurgu halkası görünür) + gönderim.
    vfLoadShotLib().then(function (lib) {
      if (!lib) return null;
      // Görünür alanı yakala: klonu kaydırma kadar ötele → ekran görüntüsü
      // kullanıcının O AN gördüğü alanı gösterir. Aksi halde html-to-image
      // documentElement.clientHeight kadar bir alanı sayfanın EN ÜSTÜNDEN
      // çeker ve aşağı kaydırılmış sayfada işaret görüntü dışında kalırdı.
      return lib.toJpeg(document.documentElement, {
        quality: 0.6,
        pixelRatio: 1,
        skipFonts: true,
        width: window.innerWidth,
        height: window.innerHeight,
        style: {
          transform:
            "translate(-" + (window.pageXOffset || 0) + "px, -" +
            (window.pageYOffset || 0) + "px)",
          transformOrigin: "top left",
        },
        // Widget kromu (toast/katman/ipucu/form/pin/launcher) görüntüye
        // girmesin; yalnız sayfa içeriği + vurgu halkası yakalanır.
        filter: function (node) {
          var cl = node && node.classList;
          if (!cl) return true;
          return !(
            cl.contains("feedl-vf-toast") ||
            cl.contains("feedl-vf-layer") ||
            cl.contains("feedl-vf-hint") ||
            cl.contains("feedl-vf-form") ||
            cl.contains("feedl-vf-pin") ||
            cl.contains("feedl-widget-launcher") ||
            cl.contains("feedl-widget-overlay")
          );
        },
      }).catch(function () { return null; });
    }).then(function (dataUrl) {
      if (vfMark) { vfMark.remove(); vfMark = null; }
      // Sunucudaki MAX_IMAGE_BYTES (1.5MB ikili) ile hizalı: base64 ≈ 4/3 ×
      // ikili → 2MB data-URL üstü zaten sunucuda düşürülür, boşuna yüklemeyiz.
      if (dataUrl && dataUrl.length < 2_000_000) payload.screenshot = dataUrl;
      var url = baseUrl + "/api/widget/visual-feedback" + (workspace ? "?ws=" + encodeURIComponent(workspace) : "");
      return fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }).then(function (res) {
      return res.json().then(function (json) { return { ok: res.ok, json: json }; });
    }).then(function (r) {
      if (!r.ok || !r.json || !r.json.success) {
        vfToastUpdate(toast, (r.json && r.json.error) || "Geri bildirim gönderilemedi.", true);
        return;
      }
      vfToastUpdate(toast, "Teşekkürler! Geri bildirimin alındı.", false);
    }).catch(function () {
      vfToastUpdate(toast, "Bağlantı hatası. Tekrar deneyin.", true);
    }).then(function () {
      vfSending = false;
    });
  }

  function vfStart() {
    if (vfSending) return;
    vfCleanup();
    vfLayer.hidden = false;
    vfHint.hidden = false;
  }

  // Buton artık widget panelinin (iframe) içinde — panel "feedl:visual-start"
  // mesajı gönderince pin modu host sayfada başlar. Mesaj yalnız feedl
  // origin'inden kabul edilir.
  window.addEventListener("message", function (event) {
    if (event.origin !== feedlOrigin) return;
    if (event.data && event.data.type === "feedl:visual-start") {
      closeWidget();
      vfStart();
    }
  });

  vfLayer.addEventListener("click", function (event) {
    if (vfSending || event.target !== vfLayer) return;
    var x = event.clientX;
    var y = event.clientY;
    if (vfPin) vfPin.remove();
    vfPin = document.createElement("div");
    vfPin.className = "feedl-vf-pin";
    vfPin.style.left = x + "px";
    vfPin.style.top = y + "px";
    document.body.appendChild(vfPin);
    vfHint.hidden = true;
    if (vfForm) { vfForm.remove(); vfForm = null; }
    vfOpenForm(x, y);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !vfLayer.hidden) vfCleanup();
  });
})();
