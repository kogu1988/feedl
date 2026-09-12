import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (plan matrisi, kullanıcı kararı) — REGRESYON TESTİ.
//
// "Şirket/fırsat (MRR) verisi girme ekranları" Pro'ya alındı ama ŞİRKET + ÜYE
// yönetimi Free kaldı: `loadCustomerCounts` dashboard'daki "Müşteri" sayacını
// company_members üzerinden hesaplar, tüm ekranı kapatmak Free'nin değerini
// kırpardı. Bu dosya o ayrımı kanıtlar:
//   - POST şirket + mrr > 0 + free → 403, HİÇ yazma yok
//   - POST şirket + mrr yok + free → 201 (şirket yönetimi Free)
//   - PATCH şirket + mrr > 0 + free → 403, update YOK
//   - PATCH şirket + mrr alanı YOK + free → 200 ve `set` mrr İÇERMEZ
//     (eski MRR korunur — Free kullanıcı adını değiştirince verisi silinmez)
//   - GET /api/admin/opportunities + free → 403 (fırsatlar tamamen Pro)

const h = vi.hoisted(() => ({
  plan: "free" as "free" | "pro",
  selectResults: [] as unknown[][],
  selectIndex: 0,
  inserted: [] as Record<string, unknown>[],
  updatedSet: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminUserId: async () => "user-1",
}));

vi.mock("@/lib/db/workspace", () => ({
  getWorkspaceId: async () => "ws-1",
}));

vi.mock("@/lib/paddle", () => ({
  getPlanLimits: async () => ({
    key: h.plan,
    label: h.plan,
    trackedUserLimit: 50,
    boardLimit: 1,
    memberLimit: 1,
  }),
}));

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => unknown) =>
      resolve(h.selectResults[h.selectIndex++] ?? []),
  };
  return {
    getDb: () => ({
      select: () => chain,
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            h.inserted.push(values);
            return [{ id: "company-new", ...values }];
          },
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              h.updatedSet.push(values);
              return [{ id: "company-1" }];
            },
          }),
        }),
      }),
    }),
  };
});

import { POST, PATCH } from "@/app/api/admin/companies/route";
import { GET as opportunitiesGet } from "@/app/api/admin/opportunities/route";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function jsonRequest(body: unknown): Request {
  return new Request("https://feedl.app/api/admin/companies", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.plan = "free";
  h.selectResults = [];
  h.selectIndex = 0;
  h.inserted = [];
  h.updatedSet = [];
});

describe("companies — MRR girişi Pro kapısı", () => {
  it("free + mrr > 0 → 403 ve HİÇ şirket yazılmaz", async () => {
    const res = await POST(jsonRequest({ name: "Acme", mrr: 1500 }));
    expect(res.status).toBe(403);
    expect(h.inserted).toHaveLength(0);
  });

  it("free + mrr yok → 201 (şirket yönetimi Free kalır)", async () => {
    const res = await POST(jsonRequest({ name: "Acme" }));
    expect(res.status).toBe(201);
    expect(h.inserted).toHaveLength(1);
  });

  it("pro + mrr > 0 → 201 ve MRR yazılır", async () => {
    h.plan = "pro";
    const res = await POST(jsonRequest({ name: "Acme", mrr: 1500 }));
    expect(res.status).toBe(201);
    expect(h.inserted[0].mrr).toBe("1500");
  });

  it("free + PATCH mrr > 0 → 403 ve update YOK", async () => {
    const res = await PATCH(jsonRequest({ id: COMPANY_ID, name: "Acme", mrr: 900 }));
    expect(res.status).toBe(403);
    expect(h.updatedSet).toHaveLength(0);
  });

  it("free + PATCH'te mrr alanı YOK → 200 ve `set` mrr İÇERMEZ (eski veri korunur)", async () => {
    const res = await PATCH(jsonRequest({ id: COMPANY_ID, name: "Yeni ad" }));
    expect(res.status).toBe(200);
    expect(h.updatedSet).toHaveLength(1);
    expect("mrr" in h.updatedSet[0]).toBe(false);
  });

  it("free + PATCH mrr: 0 → 200 (0/null 'gelir bilgisi yok' sayılır)", async () => {
    const res = await PATCH(jsonRequest({ id: COMPANY_ID, name: "Acme", mrr: 0 }));
    expect(res.status).toBe(200);
  });
});

describe("opportunities — tamamen Pro", () => {
  it("free → GET 403 (fırsat listesi Pro)", async () => {
    const res = await opportunitiesGet();
    expect(res.status).toBe(403);
  });

  it("pro → GET 200 (kapı açık)", async () => {
    h.plan = "pro";
    h.selectResults = [[]];
    const res = await opportunitiesGet();
    expect(res.status).toBe(200);
  });
});
