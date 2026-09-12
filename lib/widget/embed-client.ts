// Self-embed'in CLIENT tarafı: script'i yüzeye girildiğinde yükle, yüzeyden
// çıkıldığında widget'ı sök.
//
// Neden gerekli (2026-09-12): widget düğümlerini `document.body`'ye widget.js
// ekliyor ve silinirse geri koyuyordu. Next.js client-side gezinmesinde React
// yalnız `<script>` etiketini kaldırır; düğümler React'in dışında kaldığı için
// `/roadmap`'ten `/portal`'a ya da `/dashboard`'a geçince balon "hayalet" olarak
// kalıyordu (owner bunu canlıda bildirdi). Artık yüzey değişiminde açıkça
// sökülüyor.
//
// "use client" YOK ve "server-only" YOK: yalnız tarayıcı API'leri kullanır,
// çağıran client bileşendir.
import type { FeedlSelfEmbedConfig } from "./embed";

// Yüklediğimiz script'in kimliği: hem "zaten enjekte edildi mi" kontrolü hem
// söküm sırasında hedefleme için.
const SCRIPT_ID = "feedl-widget-script";

// widget.js'in body'ye eklediği tüm düğüm sınıfları (launcher, panel, görsel
// geri bildirim katmanları, toast/pin/form). Sökümde güvence temizliği için.
const WIDGET_NODE_SELECTOR = [
  ".feedl-widget-launcher",
  ".feedl-widget-overlay",
  ".feedl-widget-panel",
  ".feedl-vf-layer",
  ".feedl-vf-hint",
  ".feedl-vf-pin",
  ".feedl-vf-mark",
  ".feedl-vf-form",
  ".feedl-vf-toast",
].join(",");

interface FeedlWindow extends Window {
  __feedlWidgetLoaded?: boolean;
}

function feedlWindow(): FeedlWindow {
  return window as FeedlWindow;
}

// Widget'ı yükle (idempotent). Zaten yüklüyse veya script yolda ise hiçbir şey
// yapmaz — React effect'i her yüzeye girişte çağırabilir.
//
// Not: script JSX ile DEĞİL, elle enjekte edilir. Böylece widget düğümleri
// React ağacının dışında kalır (hidrasyon çakışması yok) ve sökümü biz
// kontrol ederiz.
export function ensureFeedlWidget(config: FeedlSelfEmbedConfig): void {
  if (typeof window === "undefined") return;
  const w = feedlWindow();
  if (w.__feedlWidgetLoaded) return;
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = config.src;
  script.async = true;
  // Nitelikler: widget.js bunları `document.currentScript` üzerinden okur
  // (dinamik eklenen script'lerde de geçerlidir).
  script.setAttribute("data-feedl-url", config.baseUrl);
  script.setAttribute("data-feedl-workspace", config.workspace);
  script.setAttribute("data-button-text", config.buttonText);
  if (config.accent) script.setAttribute("data-accent", config.accent);
  // feedl'in kendi yüzeyi: ziyaretçinin temasını izle.
  script.setAttribute("data-theme", "auto");
  document.head.appendChild(script);
}

// Widget'ı tamamen sök: widget.js'in `destroy()`'u varsa onu çağır, sonra
// güvence olarak kalan düğümleri/script'i temizle.
//
// Güvence temizliği KASITLI olarak çift: kullanıcının tarayıcısında eski
// (destroy'suz) widget.js önbellekte olabilir; o durumda da hayalet balon
// kalmamalı.
export function teardownFeedlWidget(): void {
  if (typeof window === "undefined") return;
  const w = feedlWindow();

  const api = w.feedlWidget;
  if (api && typeof api.destroy === "function") {
    try {
      api.destroy();
    } catch {
      /* söküm hatası sayfayı bozmasın — aşağıdaki güvence temizliği devralır */
    }
  }

  document.getElementById(SCRIPT_ID)?.remove();
  document.querySelectorAll(WIDGET_NODE_SELECTOR).forEach((node) => node.remove());
  // Yeni bir yüzeye girildiğinde widget yeniden kurulabilsin.
  w.__feedlWidgetLoaded = false;
}
