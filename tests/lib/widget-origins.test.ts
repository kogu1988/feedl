import { describe, expect, it } from "vitest";

import { normalizeWidgetOrigin } from "@/lib/widget/origins";

describe("normalizeWidgetOrigin", () => {
  it("accepts bare scheme+host and drops trailing slash", () => {
    expect(normalizeWidgetOrigin("https://example.com")).toBe(
      "https://example.com",
    );
    expect(normalizeWidgetOrigin("https://example.com/")).toBe(
      "https://example.com",
    );
  });

  it("lowercases the hostname and keeps the port", () => {
    expect(normalizeWidgetOrigin("http://MyShop.Local:3000")).toBe(
      "http://myshop.local:3000",
    );
  });

  it("rejects paths, queries, hashes and userinfo", () => {
    expect(normalizeWidgetOrigin("https://example.com/app")).toBeNull();
    expect(normalizeWidgetOrigin("https://example.com/?x=1")).toBeNull();
    expect(normalizeWidgetOrigin("https://example.com/#top")).toBeNull();
    expect(normalizeWidgetOrigin("https://user:pass@example.com")).toBeNull();
  });

  it("rejects non-http schemes and junk", () => {
    expect(normalizeWidgetOrigin("ftp://example.com")).toBeNull();
    expect(normalizeWidgetOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeWidgetOrigin("   ")).toBeNull();
    expect(normalizeWidgetOrigin("not a url")).toBeNull();
  });
});
