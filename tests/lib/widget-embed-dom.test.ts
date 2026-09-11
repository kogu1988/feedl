import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

// Widget gömme betiği (public/widget.js) bir tarayıcı IIFE'si. Burada gerçek
// DOM yerine minimal bir stub ile `vm` içinde çalıştırılır.
//
// İki regresyon korunuyor:
//  1) Script `<head>`'de çalıştığında `document.body` henüz yoktur; doğrudan
//     `appendChild` TypeError atıp widget'ı komple öldürürdü.
//  2) Next.js App Router root layout `<html>`/`<body>` render ettiği için React
//     `<body>`'yi hidrasyon sırasında sahiplenir: widget o anda body'de olursa
//     React #418 uyuşmazlık hatası verip body'yi yeniden render eder ve widget
//     SİLİNİR (kanıt: tools/prove-widget-race.mjs). Bu yüzden bağlanma `load` +
//     boşta kalma anına ertelenir.
const SOURCE = readFileSync(
  fileURLToPath(new URL("../../public/widget.js", import.meta.url)),
  "utf8",
);

interface FakeEl {
  tagName: string;
  children: FakeEl[];
  style: Record<string, string>;
  className: string;
  hidden: boolean;
  isConnected: boolean;
  _attrs: Record<string, string>;
  lastChild: FakeEl | null;
  appendChild(child: FakeEl): FakeEl;
  removeChild(child: FakeEl): FakeEl;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  addEventListener(): void;
  removeEventListener(): void;
  querySelector(): null;
}

// Launcher varsayılanı = feedl marka rengi. Free plan snippet'e `data-accent`
// yazmadığı için marka rengi uygulanır (plan matrisi); Pro özelleştirir.
const ACCENT_BRAND = "#ff5c35";

function makeEl(tag = "div"): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    children: [] as FakeEl[],
    style: {} as Record<string, string>,
    className: "",
    hidden: false,
    isConnected: false,
    _attrs: {} as Record<string, string>,
    _html: "",
    lastChild: null as FakeEl | null,
    appendChild(child: FakeEl) {
      el.children.push(child);
      child.isConnected = true;
      return child;
    },
    removeChild(child: FakeEl) {
      el.children = el.children.filter((c) => c !== child);
      child.isConnected = false;
      return child;
    },
    remove() {
      el.isConnected = false;
    },
    setAttribute(name: string, value: string) {
      el._attrs[name] = value;
    },
    getAttribute(name: string) {
      return el._attrs[name] ?? null;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
  };
  // widget.js `launcher.innerHTML = ...` yazıp ardından `lastChild.textContent`
  // atar; stub bu yüzden innerHTML set edilince bir çocuk üretir.
  Object.defineProperty(el, "innerHTML", {
    get: () => el._html,
    set(value: string) {
      el._html = value;
      el.lastChild = value ? makeEl("span") : null;
    },
  });
  return el as unknown as FakeEl;
}

function bootWidget({
  bodyAvailable,
  attrs = {},
}: {
  bodyAvailable: boolean;
  attrs?: Record<string, string>;
}) {
  const head = makeEl("head");
  const body = makeEl("body");
  body.isConnected = true;
  const docListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const loadListeners: ((...args: unknown[]) => void)[] = [];
  const idleQueue: (() => void)[] = [];

  const currentScript = makeEl("script");
  currentScript.setAttribute("data-feedl-url", "https://feedl.app");
  currentScript.setAttribute("data-feedl-workspace", "feedl");
  for (const [key, value] of Object.entries(attrs)) {
    currentScript.setAttribute(key, value);
  }

  const document = {
    currentScript,
    head,
    body: bodyAvailable ? body : null,
    readyState: "loading",
    createElement: (tag: string) => makeEl(tag),
    getElementsByTagName: () => [] as FakeEl[],
    addEventListener: (type: string, fn: (...args: unknown[]) => void) => {
      (docListeners[type] ??= []).push(fn);
    },
  };

  const window = {
    addEventListener(type: string, fn: (...args: unknown[]) => void) {
      if (type === "load") loadListeners.push(fn);
    },
    requestIdleCallback(fn: () => void) {
      idleQueue.push(fn);
      return idleQueue.length;
    },
    matchMedia: undefined as unknown,
  };

  const sandbox = {
    window,
    document,
    navigator: { userAgent: "vitest" },
    location: { href: "https://example.com/pricing" },
    console,
    // Gerçek zamanlayıcı kurma (8sn emniyet supabı testleri asmasın).
    setTimeout: () => 0,
    clearTimeout: () => {},
    URL,
    MutationObserver: undefined as unknown,
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ success: true }) }),
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "widget.js" });

  // `load` geldi varsayıp bekleyen bağlanmayı tamamla.
  // Gerçek tarayıcı sırası taklit edilir: DOMContentLoaded tetiklenmeden ÖNCE
  // `document.body` atanır (head'e konan async embed'in beklediği an).
  function finishLoad() {
    if (!document.body) document.body = body;
    for (const fn of docListeners.DOMContentLoaded ?? []) fn();
    document.readyState = "complete";
    for (const fn of loadListeners) fn();
    for (const fn of idleQueue) fn();
  }

  return { body, docListeners, window, document, finishLoad };
}

function mountBody(body: FakeEl) {
  return body.children.map((c) => c.className);
}

function launcherOf(body: FakeEl): FakeEl | undefined {
  return body.children.find((c) => c.className === "feedl-widget-launcher");
}

describe("widget embed — gövde hazır olma ve hidrasyon yarışı", () => {
  it("document.body yokken hiçbir şey bağlamaz, sonra bağlar", () => {
    const { body, finishLoad } = bootWidget({ bodyAvailable: false });
    expect(mountBody(body)).toEqual([]);
    finishLoad();
    expect(mountBody(body)).toContain("feedl-widget-launcher");
    expect(mountBody(body)).toContain("feedl-widget-overlay");
  });

  it("body hazır olsa bile HİDRASYON bitene kadar bağlanmayı erteler", () => {
    const { body, finishLoad } = bootWidget({ bodyAvailable: true });

    // Kritik: body hazır olsa da `load` gelmeden bağlanmamalı — aksi halde
    // React hidrasyonu sırasında body'de oluruz ve #418 ile siliniriz.
    expect(mountBody(body)).toEqual([]);

    finishLoad();
    expect(mountBody(body)).toContain("feedl-widget-launcher");
    expect(mountBody(body)).toContain("feedl-widget-overlay");
  });

  it("idempotans bayrağını yalnız doğrulama geçtikten sonra set eder", () => {
    const { window } = bootWidget({ bodyAvailable: true });
    expect((window as unknown as { __feedlWidgetLoaded?: boolean }).__feedlWidgetLoaded).toBe(true);
  });
});

describe("widget launcher rengi — plan matrisi ve görünürlük", () => {
  it("data-accent yoksa marka rengini kullanır (free plan varsayılanı)", () => {
    const { body, finishLoad } = bootWidget({
      bodyAvailable: true,
      attrs: { "data-theme": "light" },
    });
    finishLoad();
    expect(launcherOf(body)?.style.background).toBe(ACCENT_BRAND);
  });

  it("koyu temada da marka renginde kalır (koyu zeminde görünür)", () => {
    const { body, finishLoad } = bootWidget({
      bodyAvailable: true,
      attrs: { "data-theme": "dark" },
    });
    finishLoad();
    expect(launcherOf(body)?.style.background).toBe(ACCENT_BRAND);
  });

  it("açıkça verilen data-accent kazanır (Pro özel rengi)", () => {
    const { body, finishLoad } = bootWidget({
      bodyAvailable: true,
      attrs: { "data-theme": "dark", "data-accent": "#123456" },
    });
    finishLoad();
    expect(launcherOf(body)?.style.background).toBe("#123456");
  });

  it("geçersiz data-accent marka rengine düşer", () => {
    const { body, finishLoad } = bootWidget({
      bodyAvailable: true,
      attrs: { "data-accent": "javascript:alert(1)" },
    });
    finishLoad();
    expect(launcherOf(body)?.style.background).toBe(ACCENT_BRAND);
  });

  it("metin rengini arka plana göre seçer (mercan üstünde koyu yazı)", () => {
    const { body, finishLoad } = bootWidget({ bodyAvailable: true });
    finishLoad();
    expect(launcherOf(body)?.style.color).toBe("#18181b");
  });
});
