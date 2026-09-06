import { describe, expect, it } from "vitest";

import { buildPostSearch, foldTr, TR_FOLD_SOURCE, TR_FOLD_TARGET } from "@/lib/post-search";

describe("fold single-source invariant", () => {
  it("derives translate source/target of equal length", () => {
    expect(TR_FOLD_SOURCE.length).toBe(TR_FOLD_TARGET.length);
    expect(TR_FOLD_SOURCE.length).toBeGreaterThan(0);
  });

  it("exposes every Turkish/ascii-I special char once", () => {
    const expected = "çğıöşüİIÇĞÖŞÜ";
    expect([...TR_FOLD_SOURCE].sort()).toEqual([...expected].sort());
    expect([...TR_FOLD_SOURCE].length).toBe(new Set([...TR_FOLD_SOURCE]).size);
  });
});

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
