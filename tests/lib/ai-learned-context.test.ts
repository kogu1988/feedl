import { describe, expect, it } from "vitest";

// Faz 3 (AI öğrenme) — workspace triage sinyallerinden prompt bağlamı (saf).
// Boş liste → "" (bağlam eklenmez); not_relevant / type_corrected satırları
// okunur bir metne dönüşür.
import { buildLearnedContext } from "@/lib/ai/prompts";

describe("buildLearnedContext", () => {
  it("returns empty for no signals", () => {
    expect(buildLearnedContext([])).toBe("");
  });

  it("renders a not_relevant signal", () => {
    const out = buildLearnedContext([
      { kind: "not_relevant", title: "Logo rengi" },
    ]);
    expect(out).toContain("Logo rengi");
    expect(out).toContain("İLGİSİZ");
  });

  it("renders a type_corrected signal with ai/correct values", () => {
    const out = buildLearnedContext([
      {
        kind: "type_corrected",
        title: "Ödeme çalışmıyor",
        aiValue: "feature",
        correctValue: "bug",
      },
    ]);
    expect(out).toContain("Ödeme çalışmıyor");
    expect(out).toContain('AI "feature"');
    expect(out).toContain('doğrusu "bug"');
  });

  it("collects multiple signals and truncates long titles", () => {
    const longTitle = "x".repeat(200);
    const out = buildLearnedContext([
      { kind: "not_relevant", title: "A" },
      { kind: "not_relevant", title: longTitle },
    ]);
    // Başlık satırı + 2 sinyal satırı.
    expect(out.split("\n").length).toBe(3);
    // Başlık 80 karaktere kırpılır.
    expect(out).toContain("x".repeat(80));
    expect(out).not.toContain("x".repeat(81));
  });

  it("skips empty titles", () => {
    const out = buildLearnedContext([
      { kind: "not_relevant", title: "   " },
      { kind: "not_relevant", title: "Gerçek" },
    ]);
    expect(out).toContain("Gerçek");
    expect(out.split("\n").filter((l) => l.startsWith("- ")).length).toBe(1);
  });
});
