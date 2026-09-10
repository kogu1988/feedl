import { describe, expect, it } from "vitest";

// Faz 1 — otomatik teknik bağlam (saf fonksiyonlar). Cihaz/tarayıcı/OS
// ayrıştırma UA + viewport'tan; sunucu çözümleyici eksik alanları UA ile
// tamamlar. Bu testler AI triage'a giden bağlamın doğru üretildiğini sabitler.
import {
  deriveDeviceType,
  parseBrowser,
  parseOs,
  resolveClientContext,
} from "@/lib/client-context";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

describe("deriveDeviceType", () => {
  it("detects mobile from UA", () => {
    expect(deriveDeviceType(IPHONE, 390)).toBe("mobile");
    expect(deriveDeviceType(ANDROID_PHONE, 390)).toBe("mobile");
  });

  it("detects tablet from UA even at desktop-ish widths (iPad)", () => {
    expect(deriveDeviceType(IPAD, 1024)).toBe("tablet");
    expect(deriveDeviceType(ANDROID_TABLET, 800)).toBe("tablet");
  });

  it("falls back to viewport width when UA is desktop", () => {
    expect(deriveDeviceType(WINDOWS_CHROME, 390)).toBe("mobile");
    expect(deriveDeviceType(WINDOWS_CHROME, 800)).toBe("tablet");
    expect(deriveDeviceType(WINDOWS_CHROME, 1440)).toBe("desktop");
  });

  it("defaults to desktop without signals", () => {
    expect(deriveDeviceType(WINDOWS_CHROME, null)).toBe("desktop");
  });
});

describe("parseBrowser", () => {
  it("distinguishes Edge, Chrome, Safari, Firefox", () => {
    expect(parseBrowser(WINDOWS_EDGE)).toBe("Edge");
    expect(parseBrowser(WINDOWS_CHROME)).toBe("Chrome");
    expect(parseBrowser(MAC_SAFARI)).toBe("Safari");
    expect(parseBrowser("Mozilla/5.0 Firefox/128.0")).toBe("Firefox");
  });

  it("returns null for empty UA", () => {
    expect(parseBrowser("")).toBeNull();
  });
});

describe("parseOs", () => {
  it("detects iOS, Android, Windows, macOS, Linux", () => {
    expect(parseOs(IPHONE)).toBe("iOS");
    expect(parseOs(IPAD)).toBe("iOS");
    expect(parseOs(ANDROID_PHONE)).toBe("Android");
    expect(parseOs(WINDOWS_CHROME)).toBe("Windows");
    expect(parseOs(MAC_SAFARI)).toBe("macOS");
    expect(parseOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
  });
});

describe("resolveClientContext", () => {
  it("prefers provided values and fills gaps from the user-agent", () => {
    const ctx = resolveClientContext(
      { device: "mobile", viewportWidth: 390, viewportHeight: 844, pageUrl: "/checkout" },
      WINDOWS_CHROME,
    );
    expect(ctx.device).toBe("mobile");
    expect(ctx.viewportWidth).toBe(390);
    expect(ctx.browser).toBe("Chrome"); // UA'dan tamamlandı
    expect(ctx.os).toBe("Windows");
    expect(ctx.pageUrl).toBe("/checkout");
  });

  it("derives everything from the user-agent when nothing is provided", () => {
    const ctx = resolveClientContext(undefined, IPHONE);
    expect(ctx.device).toBe("mobile");
    expect(ctx.browser).toBe("Safari");
    expect(ctx.os).toBe("iOS");
    expect(ctx.viewportWidth).toBeNull();
    expect(ctx.pageUrl).toBeNull();
  });
});
