import { describe, expect, it } from "vitest";

import { statusLabels, summarize } from "@/lib/post-format";

describe("statusLabels", () => {
  it("maps the canny.md status flow", () => {
    expect(statusLabels.open).toBe("Açık");
    expect(statusLabels["under-review"]).toBe("İncelemede");
    expect(statusLabels.planned).toBe("Planlandı");
    expect(statusLabels["in-progress"]).toBe("Geliştiriliyor");
    expect(statusLabels.shipped).toBe("Yayınlandı");
    expect(statusLabels.closed).toBe("Kapatıldı");
  });
});

describe("summarize", () => {
  it("returns short text unchanged", () => {
    expect(summarize("Kısa fikir")).toBe("Kısa fikir");
  });

  it("truncates long text at the limit with ellipsis", () => {
    const text = "a".repeat(200);
    expect(summarize(text)).toBe(`${"a".repeat(160)}…`);
  });

  it("honors custom limits and trims trailing spaces", () => {
    expect(summarize("abcdef  ", 3)).toBe("abc…");
    expect(summarize("ab", 3)).toBe("ab");
  });
});
