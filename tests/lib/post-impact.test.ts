import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (frontend_plan P0-6/P0-7) — iş etkisi katmanı testleri.
//
// En önemli iki kilit:
//  1) TOPLAMA MANTIĞI: şirket DISTINCT sayılır (aynı şirketin iki üyesinin oyu
//     MRR'i şişirmez) ve `null` MRR ile "0" MRR AYRI değerlendirilir
//     (frontend_plan §19: "$0 MRR" ile "veri yok" aynı şey değildir).
//  2) TENANT İZOLASYONU: 2026-09-12'de burada GERÇEK bir sızıntı bulundu —
//     şirket sorgusu `companies.workspace_id` ile filtrelenmiyordu, bu yüzden
//     başka bir workspace'in şirketi/MRR'i bu workspace'in skoruna sızabiliyordu.
//     Aşağıdaki test, üretilen WHERE koşulunun workspace id'sini İÇERDİĞİNİ
//     doğrular; filtre kaldırılırsa test kırmızıya düşer.

const h = vi.hoisted(() => ({
  rows: [] as unknown[][],
  whereArgs: [] as unknown[][],
  workspaceId: "ws-test",
  // Her testte sıfırlanır: aksi halde ikinci testte zincir index'i kayar ve
  // sahte satırlar yanlış sorguya gider (ilk denemede tam olarak bu oldu).
  chainIndex: 0,
}));

vi.mock("@/lib/db/workspace", () => ({
  getWorkspaceId: async () => h.workspaceId,
}));

vi.mock("@/lib/db", () => {
  const makeChain = () => {
    const myIndex = h.chainIndex++;
    const chain: Record<string, unknown> = {
      from: () => chain,
      innerJoin: () => chain,
      where: (...args: unknown[]) => {
        h.whereArgs.push(args);
        return chain;
      },
      groupBy: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown) => unknown) => resolve(h.rows[myIndex] ?? []),
    };
    return chain;
  };
  return { getDb: () => ({ select: () => makeChain() }) };
});

import {
  computePrioritySignal,
  computeRevenueScore,
  explainRevenueScore,
  loadPostImpactContexts,
  revenueScoreOrderSql,
} from "@/lib/db/revenue-scores";

const POST_A = "11111111-1111-4111-8111-111111111111";
const POST_B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  h.rows = [];
  h.whereArgs = [];
  h.workspaceId = "ws-test";
  h.chainIndex = 0;
});

// Drizzle SQL nesnesi döngüseldir (PgTable referansları) → JSON.stringify
// patlar. Koşulun içindeki DEĞERLERİ (Param.value) toplayan küçük bir gezici.
function collectSqlValues(node: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (node === null || typeof node !== "object") {
    if (node !== undefined) out.push(String(node));
    return out;
  }
  if (seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectSqlValues(item, out, seen);
    return out;
  }
  const record = node as { value?: unknown; queryChunks?: unknown[] };
  if (record.value !== undefined && typeof record.value !== "object") {
    out.push(String(record.value));
  }
  if (Array.isArray(record.queryChunks)) {
    for (const chunk of record.queryChunks) collectSqlValues(chunk, out, seen);
  }
  return out;
}

describe("loadPostImpactContexts — toplama mantığı", () => {
  it("aynı şirketin iki üyesi oy verse de şirket ve MRR BİR kez sayılır", async () => {
    h.rows = [
      // Aynı company-1 için iki oy satırı (farklı kullanıcılar).
      [
        { postId: POST_A, companyId: "company-1", mrr: "850" },
        { postId: POST_A, companyId: "company-1", mrr: "850" },
      ],
      [],
      [{ postId: POST_A, voteCount: 2 }],
    ];
    const map = await loadPostImpactContexts([POST_A]);
    const ctx = map.get(POST_A);
    expect(ctx?.customerCount).toBe(1);
    expect(ctx?.mrrTotal).toBe(850);
    // Talep tarafı ayrı sayılır (§13): iki oy, tek müşteri.
    expect(ctx?.voteCount).toBe(2);
  });

  it("farklı şirketlerin MRR'i toplanır, iki fikir birbirine karışmaz", async () => {
    h.rows = [
      [
        { postId: POST_A, companyId: "company-1", mrr: "850" },
        { postId: POST_A, companyId: "company-2", mrr: "150" },
        { postId: POST_B, companyId: "company-3", mrr: "5000" },
      ],
      [],
    ];
    const map = await loadPostImpactContexts([POST_A, POST_B]);
    expect(map.get(POST_A)?.customerCount).toBe(2);
    expect(map.get(POST_A)?.mrrTotal).toBe(1000);
    expect(map.get(POST_B)?.customerCount).toBe(1);
    expect(map.get(POST_B)?.mrrTotal).toBe(5000);
  });

  it("`null` MRR = 'girilmemiş' (mrrKnown false), `0` = '0 olarak girilmiş' (true)", async () => {
    h.rows = [[{ postId: POST_A, companyId: "company-1", mrr: null }], [], []];
    const notProvided = await loadPostImpactContexts([POST_A]);
    expect(notProvided.get(POST_A)?.mrrKnown).toBe(false);

    // İkinci çağrı: zincir sayacı test içinde de sıfırlanmalı.
    h.chainIndex = 0;
    h.rows = [[{ postId: POST_A, companyId: "company-1", mrr: "0" }], [], []];
    const zero = await loadPostImpactContexts([POST_A]);
    expect(zero.get(POST_A)?.mrrKnown).toBe(true);
    expect(zero.get(POST_A)?.mrrTotal).toBe(0);
  });

  it("fırsat değerleri toplanır ve opportunityLinked işaretlenir", async () => {
    h.rows = [
      [],
      [
        { postId: POST_A, dealValue: "12000" },
        { postId: POST_A, dealValue: "3000" },
      ],
      [],
    ];
    const map = await loadPostImpactContexts([POST_A]);
    expect(map.get(POST_A)?.opportunityValue).toBe(15000);
    expect(map.get(POST_A)?.opportunityLinked).toBe(true);
  });

  it("şirket üyeliği olmayan oylar da talebe sayılır (§13)", async () => {
    h.rows = [[], [], [{ postId: POST_A, voteCount: 9 }]];
    const map = await loadPostImpactContexts([POST_A]);
    expect(map.get(POST_A)?.voteCount).toBe(9);
    expect(map.get(POST_A)?.customerCount).toBe(0);
  });

  it("ilişki yoksa güvenli boş bağlam döner (uydurma değer YOK)", async () => {
    h.rows = [[], [], []];
    const map = await loadPostImpactContexts([POST_A]);
    // Hiç satır gelmediği için map'te kayıt olmaz; çağıran boş bağlam varsayar.
    expect(map.get(POST_A)).toBeUndefined();
  });

  it("boş post listesinde hiç sorgu koşmaz", async () => {
    const map = await loadPostImpactContexts([]);
    expect(map.size).toBe(0);
    expect(h.whereArgs).toHaveLength(0);
  });
});

describe("loadPostImpactContexts — TENANT İZOLASYONU (§21)", () => {
  it("üretilen WHERE koşulları workspace id'sini İÇERİR (sızıntı regresyonu)", async () => {
    h.workspaceId = "ws-izole";
    h.rows = [[], [], []];
    await loadPostImpactContexts([POST_A]);

    // Üç sorgu (şirket + fırsat + oy) da workspace filtresi taşımalı.
    expect(h.whereArgs).toHaveLength(3);
    for (const args of h.whereArgs) {
      const values = collectSqlValues(args);
      expect(values).toContain("ws-izole");
    }
  });
});

// SQL parçasını (drizzle `sql`) güvenli metne çevirir: döngüsel tablo
// referansları olduğu için JSON.stringify kullanılamaz.
function sqlText(node: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (node === null || typeof node !== "object") return out;
  if (seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) sqlText(item, out, seen);
    return out;
  }
  const rec = node as { value?: unknown; name?: unknown; queryChunks?: unknown[] };
  if (typeof rec.name === "string") out.push(rec.name);
  if (Array.isArray(rec.queryChunks)) {
    for (const chunk of rec.queryChunks) sqlText(chunk, out, seen);
  }
  if (Array.isArray(rec.value)) {
    // drizzle StringChunk: `value` düz string dizisidir (SQL metni burada).
    for (const piece of rec.value) {
      if (typeof piece === "string") out.push(piece);
    }
  } else if (rec.value !== undefined && typeof rec.value !== "object") {
    out.push(String(rec.value));
  }
  return out;
}

describe("revenueScoreOrderSql — sıralama/fonksiyon tutarlılığı (P1-8)", () => {
  const text = sqlText(revenueScoreOrderSql("ws-order")).join(" ");

  it("skor formülünün bileşenlerini taşır (TS fonksiyonundan ayrışmasın)", () => {
    // computeRevenueScore: oy + 10×müşteri + (MRR + fırsat)/1000
    expect(text).toContain("10 *"); // 10 × müşteri
    expect(text).toContain("/ 1000.0");
    expect(text).toContain("COUNT(DISTINCT");
  });

  it("fırsatı yalnız açık/teklif aşamasında sayar (won/lost hariç)", () => {
    expect(text).toContain("open");
    expect(text).toContain("proposal");
  });

  it("her iç sorgu workspace ile filtrelenir ve id bağlı parametredir (§21)", () => {
    expect(text).toContain("workspace_id");
    expect(sqlText(revenueScoreOrderSql("ws-order"))).toContain("ws-order");
  });
});

describe("computePrioritySignal", () => {
  it("hiç sinyal yoksa 'none'", () => {
    expect(
      computePrioritySignal({
        voteCount: 0,
        customerCount: 0,
        mrrTotal: 0,
        openOpportunityValue: 0,
      }),
    ).toBe("none");
  });

  it("eşiklere göre yüksek/orta/düşük", () => {
    expect(
      computePrioritySignal({
        voteCount: 60,
        customerCount: 0,
        mrrTotal: 0,
        openOpportunityValue: 0,
      }),
    ).toBe("high");
    expect(
      computePrioritySignal({
        voteCount: 20,
        customerCount: 0,
        mrrTotal: 0,
        openOpportunityValue: 0,
      }),
    ).toBe("medium");
    expect(
      computePrioritySignal({
        voteCount: 3,
        customerCount: 0,
        mrrTotal: 0,
        openOpportunityValue: 0,
      }),
    ).toBe("low");
  });

  it("yüksek MRR tek başına sinyali yükseltir (oy düşük olsa bile)", () => {
    expect(
      computePrioritySignal({
        voteCount: 2,
        customerCount: 1,
        mrrTotal: 60000,
        openOpportunityValue: 0,
      }),
    ).toBe("high");
  });
});

describe("explainRevenueScore — açıklanabilirlik", () => {
  it("bileşenlerin toplamı skorla tutarlıdır (yuvarlanmış)", () => {
    const input = {
      voteCount: 27,
      customerCount: 12,
      mrrTotal: 4850,
      openOpportunityValue: 12000,
    };
    const rows = explainRevenueScore(input);
    const sum = rows.reduce((acc, row) => acc + row.contribution, 0);
    expect(Math.round(sum)).toBe(computeRevenueScore(input));
  });

  it("her bileşen için okunabilir bir etiket ve ham değer döner", () => {
    const rows = explainRevenueScore({
      voteCount: 10,
      customerCount: 2,
      mrrTotal: 1000,
      openOpportunityValue: 2000,
    });
    expect(rows.map((row) => row.label)).toEqual([
      "Oy",
      "Müşteri",
      "Müşteri MRR'i",
      "Açık fırsat",
    ]);
    expect(rows[1].detail).toContain("2 müşteri");
  });
});
