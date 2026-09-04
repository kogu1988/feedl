import { describe, expect, it } from "vitest";

import { buildPostSearch, foldTr } from "@/lib/post-search";

describe("foldTr", () => {
  it("folds Turkish diacritics and I/İ case-insensitively", () => {
    expect(foldTr("karanlık")).toBe("karanlik");
    expect(foldTr("İzleme")).toBe("izleme");
    expect(foldTr("IŞIK")).toBe("isik");
    expect(foldTr("Çağrı ÖŞÜĞİ")).toBe("cagri osugi");
  });

  it("leaves ascii text unchanged", () => {
    expect(foldTr("dark mode")).toBe("dark mode");
  });
});

describe("buildPostSearch", () => {
  it("returns no condition for blank queries", () => {
    const search = buildPostSearch("   ");
    expect(search.tokens).toEqual([]);
    expect(search.condition).toBeUndefined();
  });

  it("folds tokens and caps at 8", () => {
    const search = buildPostSearch(
      "Karanlık MOD  kayıt izleme rapor ayar tema dil arama!",
    );
    expect(search.tokens.length).toBe(8);
    expect(search.tokens[0]).toBe("karanlik");
    expect(search.tokens[1]).toBe("mod");
    expect(search.condition).toBeDefined();
  });
});
