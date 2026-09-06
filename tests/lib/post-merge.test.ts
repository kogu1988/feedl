import { describe, expect, it } from "vitest";

// Sprint 63x (test derinleştirme) — merge/unmerge SAF mantığı: doğrulama
// şeması (kendine birleştirme / uuid) + başarısızlık neden kodlama. Gerçek
// SQL CTE'leri DB ister; burada yalnız karar mantığı doğrulanır (en riskli
// hatalı-eşleme ve yanlış-sıra kısmı).
import {
  mergeFailureResult,
  mergeSchema,
  unmergeSchema,
} from "@/lib/post-merge";

describe("mergeSchema", () => {
  it("accepts valid distinct sourceId/targetId", () => {
    const parsed = mergeSchema.safeParse({
      sourceId: "89abcdef-0123-4567-89ab-cdef01234567",
      targetId: "12345678-1234-4567-8123-456789abcdef",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects self-merge (sourceId === targetId)", () => {
    const parsed = mergeSchema.safeParse({
      sourceId: "89abcdef-0123-4567-89ab-cdef01234567",
      targetId: "89abcdef-0123-4567-89ab-cdef01234567",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid uuids", () => {
    const parsed = mergeSchema.safeParse({
      sourceId: "not-a-uuid",
      targetId: "89abcdef-0123-4567-89ab-cdef01234567",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("unmergeSchema", () => {
  it("accepts a uuid", () => {
    const parsed = unmergeSchema.safeParse({
      sourceId: "89abcdef-0123-4567-89ab-cdef01234567",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-uuid", () => {
    const parsed = unmergeSchema.safeParse({ sourceId: "abc" });
    expect(parsed.success).toBe(false);
  });
});

describe("mergeFailureResult", () => {
  it("maps not-found reasons to 404", () => {
    expect(mergeFailureResult("source_not_found").status).toBe(404);
    expect(mergeFailureResult("target_not_found").status).toBe(404);
  });

  it("maps already-merged reasons to 409/400", () => {
    expect(mergeFailureResult("source_merged").status).toBe(409);
    expect(mergeFailureResult("no_op").status).toBe(409);
    // Hedef birleşmişse zincir oluşmaz — 400 (reddedilebilir).
    expect(mergeFailureResult("target_merged").status).toBe(400);
  });

  it("defaults unknown/undefined reason to 409 no_op", () => {
    expect(mergeFailureResult(undefined).status).toBe(409);
    expect(mergeFailureResult("something_else" as never).status).toBe(409);
  });
});
