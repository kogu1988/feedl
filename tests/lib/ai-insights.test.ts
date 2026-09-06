import { describe, expect, it } from "vitest";

// Sprint 63n — corpus-insights 32 failed run kök nedeni: serbest LLM `themes`
// alanını string[] döndürüyordu, şema nesne dizisi bekliyordu → Zod patlıyordu.
// Bu test, normalizasyonun şekil farkını tolere ettiğini kanıtlar.
import { normalizeCorpusInsights } from "@/lib/ai/insights";

describe("normalizeCorpusInsights", () => {
  it("coerces string themes to {name,count,summary} objects", () => {
    const raw = {
      themes: ["UI/UX erişilebilirlik", "Ödeme altyapısı güvenilirliği"],
      trends: ["Karanlık mod talebi büyüyor"],
      quickWins: ["Karanlık mod MVP", "Hata mesajlarını detaylandır"],
      risks: ["Ödeme hatası churn riski"],
      recommendation: "Önce ödeme hatasını çöz.",
    };
    const out = normalizeCorpusInsights(raw);
    expect(out.themes).toEqual([
      { name: "UI/UX erişilebilirlik", count: 1, summary: "UI/UX erişilebilirlik" },
      { name: "Ödeme altyapısı güvenilirliği", count: 1, summary: "Ödeme altyapısı güvenilirliği" },
    ]);
    expect(out.trends).toEqual([{ name: "Karanlık mod talebi büyüyor", note: "Karanlık mod talebi büyüyor" }]);
    expect(out.quickWins).toHaveLength(2);
    expect(out.risks).toEqual([{ label: "Ödeme hatası churn riski", detail: "Ödeme hatası churn riski" }]);
    expect(out.recommendation).toBe("Önce ödeme hatasını çöz.");
  });

  it("keeps object-shaped themes and supplies defaults", () => {
    const raw = {
      themes: [{ name: "Karanlık mod", count: 3, summary: "Çok isteniyor" }],
      recommendation: "",
    };
    const out = normalizeCorpusInsights(raw);
    expect(out.themes).toEqual([{ name: "Karanlık mod", count: 3, summary: "Çok isteniyor" }]);
    // Boş recommendation → default (min(1) ihlali önlenir).
    expect(out.recommendation).toContain("geri bildirim");
  });

  it("handles malformed / non-array input gracefully", () => {
    const out = normalizeCorpusInsights({ themes: "tek string", trends: null, quickWins: 123 });
    expect(out.themes).toEqual([]);
    expect(out.trends).toEqual([]);
    expect(out.quickWins).toEqual([]);
    expect(out.risks).toEqual([]);
  });

  it("drops empty object items in themes", () => {
    const out = normalizeCorpusInsights({ themes: [{}, { name: "Tema A" }, ""] });
    expect(out.themes).toEqual([{ name: "Tema A", count: 1, summary: "Tema A" }]);
  });

  it("is idempotent on already-canonical input", () => {
    const raw = {
      themes: [{ name: "A", count: 2, summary: "s" }],
      trends: [{ name: "T", note: "n" }],
      quickWins: ["w"],
      risks: [{ label: "R", detail: "d" }],
      recommendation: "r",
    };
    const out = normalizeCorpusInsights(raw);
    expect(out).toEqual(raw);
  });
});
