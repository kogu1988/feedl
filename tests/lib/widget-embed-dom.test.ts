import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

// Widget gömme betiği (public/widget.js) bir tarayıcı IIFE'si. Burada gerçek
// DOM yerine minimal bir stub ile `vm` içinde çalıştırılır.
//
// Regresyon: script `<head>`'e konulduğunda (müşteri snippet'i ya da Next.js'in
// `async` script'i head'e taşıması) çalışma anında `document.body` henüz YOKTUR.
// Doğrudan `document.body.appendChild(...)` çağrısı TypeError atar ve widget
// HİÇ görünmez. Betik bu yüzden DOMContentLoaded'a kadar beklemeli.
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

function makeEl(tag = "div"): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    children: [] as FakeEl[],
    style: {} as Record<string, string>,
    className: "",
    hidden: false,
    _attrs: {} as Record<string, string>,
    _html: "",
    lastChild: null as FakeEl | null,
    appendChild(child: FakeEl) {
      el.children.push(child);
      return child;
    },
    removeChild(child: FakeEl) {
      el.children = el.children.filter((c) => c !== child);
      return child;
    },
    remove() {},
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

function bootWidget({ bodyAvailable }: { bodyAvailable: boolean }) {
  const head = makeEl("head");
  const body = makeEl("body");
  const docListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const currentScript = makeEl("script");
  currentScript.setAttribute("data-feedl-url", "https://feedl.app");
  currentScript.setAttribute("data-feedl-workspace", "feedl");

  const document = {
    currentScript,
    head,
    body: bodyAvailable ? body : null,
    createElement: (tag: string) => makeEl(tag),
    getElementsByTagName: () => [] as FakeEl[],
    addEventListener: (type: string, fn: (...args: unknown[]) => void) => {
      (docListeners[type] ??= []).push(fn);
    },
  };

  const window = {
    addEventListener() {},
    matchMedia: undefined as unknown,
  };

  const sandbox = {
    window,
    document,
    navigator: { userAgent: "vitest" },
    location: { href: "https://example.com/pricing" },
    console,
    setTimeout,
    clearTimeout,
    URL,
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ success: true }) }),
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "widget.js" });

  return { body, docListeners, window, document };
}

function mountBody(body: FakeEl) {
  return body.children.map((c) => c.className);
}

describe("widget embed — body henüz yokken bağlanma", () => {
  it("document.body yoksa launcher'ı DOMContentLoaded'a erteler", () => {
    const { body, docListeners, document } = bootWidget({ bodyAvailable: false });

    // Boot anında gövdeye HİÇBİR ŞEY eklenmemeli (eskiden burada TypeError
    // atıyor ve widget hiç görünmüyordu).
    expect(mountBody(body)).toEqual([]);

    // DOM hazır olduğunda launcher + overlay bağlanır. Tarayıcı, bu olayı
    // tetiklemeden önce `document.body`'yi atar — stub bunu taklit eder.
    expect(docListeners.DOMContentLoaded?.length).toBeGreaterThan(0);
    document.body = body;
    for (const fn of docListeners.DOMContentLoaded) fn();

    expect(mountBody(body)).toContain("feedl-widget-launcher");
    expect(mountBody(body)).toContain("feedl-widget-overlay");
  });

  it("document.body hazırsa senkron bağlanır", () => {
    const { body, docListeners } = bootWidget({ bodyAvailable: true });

    expect(mountBody(body)).toContain("feedl-widget-launcher");
    expect(mountBody(body)).toContain("feedl-widget-overlay");
    // Erteleme yolu kullanılmadı.
    expect(docListeners.DOMContentLoaded ?? []).toHaveLength(0);
  });

  it("idempotans bayrağını yalnız doğrulama geçtikten sonra set eder", () => {
    const { window } = bootWidget({ bodyAvailable: true });
    expect((window as unknown as { __feedlWidgetLoaded?: boolean }).__feedlWidgetLoaded).toBe(true);
  });
});
