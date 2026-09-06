import { describe, expect, it } from "vitest";

// Sprint 63w (F1) — marka rengi üzerinde okunur yazı rengi (WCAG).
import { isLightColor, textOn } from "@/lib/color";

describe("textOn", () => {
  it("returns dark ink for light brand colors", () => {
    expect(textOn("#ff5c35")).toBe("#2b0e04"); // mercan
    expect(textOn("#ffffff")).toBe("#2b0e04");
    expect(textOn("#ffe8df")).toBe("#2b0e04"); // marka soft
  });

  it("returns white for dark colors", () => {
    expect(textOn("#111827")).toBe("#ffffff");
    expect(textOn("#000000")).toBe("#ffffff");
  });

  it("falls back to dark ink for malformed values", () => {
    expect(textOn("")).toBe("#2b0e04");
    expect(textOn("#ff5")).toBe("#2b0e04"); // 3 haneli hex geçersiz burada
    expect(textOn("xyz")).toBe("#2b0e04");
  });
});

describe("isLightColor", () => {
  it("matches textOn decision", () => {
    expect(isLightColor("#ff5c35")).toBe(true);
    expect(isLightColor("#111827")).toBe(false);
  });
});
