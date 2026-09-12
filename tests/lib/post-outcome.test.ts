import { describe, expect, it } from "vitest";

import {
  OUTCOME_TYPES,
  OUTCOME_TYPE_HINTS,
  OUTCOME_TYPE_LABELS,
  createOutcomeSchema,
  formatRevenueDelta,
  normalizeOutcomeInput,
  parseRevenueDelta,
} from "@/lib/post-outcome";

// 2026-09-12 (M6 ürün eksiği) — outcome kaydının saf mantığı.
//
// Neden test: bu özellik "gerçekleşen gelir etkisi" kaydeder. Para
// ayrıştırmasındaki bir hata, sessizce YANLIŞ rakam yazar (80.000 → 80 gibi)
// ve sonraki önceliklendirme kararları o yanlış veriye dayanır — bu yüzden
// ayrıştırma/biçimleme kilitlenir.

describe("parseRevenueDelta", () => {
  it("düz sayıları okur", () => {
    expect(parseRevenueDelta("80000")).toBe(80000);
    expect(parseRevenueDelta("0")).toBe(0);
    expect(parseRevenueDelta("  12000  ")).toBe(12000);
  });

  it("Türkçe binlik ayıracını (nokta) binlik sayar", () => {
    expect(parseRevenueDelta("80.000")).toBe(80000);
    expect(parseRevenueDelta("1.234.567")).toBe(1234567);
  });

  it("sondaki 1-2 haneyi ondalık kabul eder", () => {
    expect(parseRevenueDelta("1,5")).toBe(1.5);
    expect(parseRevenueDelta("80,5")).toBe(80.5);
    expect(parseRevenueDelta("80.000,50")).toBe(80000.5);
    expect(parseRevenueDelta("1,234.56")).toBe(1234.56);
  });

  it("negatif değeri korur (churn / kayıp da kaydedilir)", () => {
    expect(parseRevenueDelta("-12000")).toBe(-12000);
    expect(parseRevenueDelta("-12.000,25")).toBe(-12000.25);
  });

  it("para simgesi ve boşlukları yok sayar", () => {
    expect(parseRevenueDelta("$80,000")).toBe(80000);
    expect(parseRevenueDelta("$ 80.000")).toBe(80000);
  });

  it("ayrıştırılamayan girdide null döner (uydurma 0 DEĞİL)", () => {
    expect(parseRevenueDelta("")).toBe(null);
    expect(parseRevenueDelta("   ")).toBe(null);
    expect(parseRevenueDelta("abc")).toBe(null);
    expect(parseRevenueDelta("—")).toBe(null);
  });
});

describe("formatRevenueDelta", () => {
  it("dolar işareti ve tr-TR binlik ayıracıyla biçimler", () => {
    expect(formatRevenueDelta(80000)).toBe("$80.000");
    expect(formatRevenueDelta("80000")).toBe("$80.000");
    expect(formatRevenueDelta(0)).toBe("$0");
  });

  it("negatifi işaretin arkasına koyar", () => {
    expect(formatRevenueDelta(-12000)).toBe("-$12.000");
  });

  it("'veri yok' ile sıfırı AYIRIR", () => {
    // frontend_plan §19: bilinmeyen tutar uydurma $0 olarak gösterilmez.
    expect(formatRevenueDelta(null)).toBe(null);
    expect(formatRevenueDelta(undefined)).toBe(null);
    expect(formatRevenueDelta("")).toBe(null);
    expect(formatRevenueDelta("abc")).toBe(null);
  });
});

describe("outcome türleri", () => {
  it("her türün etiketi ve ipucu vardır", () => {
    // Yeni tür eklenip etiketi unutulursa arayüzde ham anahtar ("expansion")
    // görünürdü; bu test onu engeller.
    for (const type of OUTCOME_TYPES) {
      expect(OUTCOME_TYPE_LABELS[type], type).toBeTruthy();
      expect(OUTCOME_TYPE_HINTS[type], type).toBeTruthy();
    }
  });
});

describe("createOutcomeSchema + normalizeOutcomeInput", () => {
  const base = {
    postId: "6f1c2f7e-2b1a-4c3d-8e9f-0a1b2c3d4e5f",
    outcomeType: "expansion" as const,
    summary: "3 müşteri planını yükseltti.",
  };

  it("geçerli gövdeyi kabul eder ve gelir dizesini sayıya çevirir", () => {
    const parsed = createOutcomeSchema.parse({
      ...base,
      revenueDelta: "80.000,50",
      evidenceUrl: "https://example.com/rapor",
      occurredAt: "2026-09-01",
    });
    const normalized = normalizeOutcomeInput(parsed);
    expect(normalized.revenueDelta).toBe(80000.5);
    expect(normalized.evidenceUrl).toBe("https://example.com/rapor");
    expect(normalized.occurredAt).toBe("2026-09-01");
  });

  it("gelir verilmezse null kalır (0 yazılmaz)", () => {
    const normalized = normalizeOutcomeInput(
      createOutcomeSchema.parse({ ...base, revenueDelta: "" }),
    );
    expect(normalized.revenueDelta).toBe(null);
  });

  it("sayı olarak gelen geliri olduğu gibi alır", () => {
    const normalized = normalizeOutcomeInput(
      createOutcomeSchema.parse({ ...base, revenueDelta: -500 }),
    );
    expect(normalized.revenueDelta).toBe(-500);
  });

  it("boş/eksik opsiyonel alanları null'a indirir", () => {
    const normalized = normalizeOutcomeInput(
      createOutcomeSchema.parse({ ...base, evidenceUrl: "", occurredAt: null }),
    );
    expect(normalized.evidenceUrl).toBe(null);
    expect(normalized.occurredAt).toBe(null);
  });

  it("bilinmeyen türü reddeder", () => {
    const result = createOutcomeSchema.safeParse({
      ...base,
      outcomeType: "guess",
    });
    expect(result.success).toBe(false);
  });

  it("çok kısa özeti reddeder", () => {
    expect(
      createOutcomeSchema.safeParse({ ...base, summary: "ok" }).success,
    ).toBe(false);
  });

  it("http(s) olmayan kanıt linkini reddeder", () => {
    expect(
      createOutcomeSchema.safeParse({
        ...base,
        evidenceUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("hatalı tarih biçimini reddeder", () => {
    expect(
      createOutcomeSchema.safeParse({ ...base, occurredAt: "01.09.2026" }).success,
    ).toBe(false);
  });

  it("uuid olmayan postId'yi reddeder", () => {
    expect(
      createOutcomeSchema.safeParse({ ...base, postId: "abc" }).success,
    ).toBe(false);
  });
});
