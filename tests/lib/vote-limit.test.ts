import { describe, expect, it } from "vitest";

// Sprint 64 (test derinleştirme) — free plan oy limiti kararı (saf).
// shouldAllowVote DB'ye dokunmaz; enforceVoteLimit bu kararı sorgu sonuçlarıyla
// besler. Bu, 50-distinct-oyveren kuralının tüm kenar durumlarını kapsar.
import { shouldAllowVote } from "@/lib/db/vote-limit";

const FREE_LIMIT = 50;

describe("shouldAllowVote", () => {
  it("allows when below the limit (yeni oy veren, limit dolmamış)", () => {
    expect(shouldAllowVote(0, false, FREE_LIMIT)).toBe(true);
    expect(shouldAllowVote(49, false, FREE_LIMIT)).toBe(true);
  });

  it("rejects a NEW voter when at/above the limit (50. kişi sınırı)", () => {
    expect(shouldAllowVote(50, false, FREE_LIMIT)).toBe(false);
    expect(shouldAllowVote(51, false, FREE_LIMIT)).toBe(false);
  });

  it("allows an EXISTING voter regardless of count (aynı kişi sayılmaz)", () => {
    expect(shouldAllowVote(50, true, FREE_LIMIT)).toBe(true);
    expect(shouldAllowVote(500, true, FREE_LIMIT)).toBe(true);
  });

  it("treats Pro (MAX_SAFE_INTEGER) as unlimited", () => {
    const inf = Number.MAX_SAFE_INTEGER;
    expect(shouldAllowVote(inf, false, inf)).toBe(true);
    expect(shouldAllowVote(inf, false, inf)).toBe(true);
  });

  it("is safe with a zero limit (misconfig — new voter blocked, existing allowed)", () => {
    expect(shouldAllowVote(0, false, 0)).toBe(false);
    expect(shouldAllowVote(0, true, 0)).toBe(true);
  });
});
