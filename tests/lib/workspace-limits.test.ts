import { describe, expect, it } from "vitest";

import { decideWorkspaceCreation } from "@/lib/db/workspace-limits";

// 2026-09-12 (kullanıcı kararı) — Free hesap 1 workspace.
//
// Neden test: bu kural bir GELİR kapısıdır. Yanlış kurulursa ya bedava
// kullanıcı sınırsız workspace açar (kaçak) ya da ödeme yapan müşteri ikinci
// workspace açamaz (gereksiz sürtünme). İki tarafı da kilitler.

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("decideWorkspaceCreation", () => {
  it("hiç workspace yoksa izin verir (ilk workspace)", () => {
    expect(decideWorkspaceCreation([])).toBe("ok");
  });

  it("tek Free workspace varken ikinciyi REDDEDER", () => {
    expect(decideWorkspaceCreation([{ plan: "free" }])).toBe("free_limit");
  });

  it("birden fazla Free workspace varsa yine reddeder (mevcut kaçak kapanır)", () => {
    expect(
      decideWorkspaceCreation([{ plan: "free" }, { plan: "free" }]),
    ).toBe("free_limit");
  });

  it("herhangi biri etkin Pro ise izin verir (ödeyen müşteri)", () => {
    expect(
      decideWorkspaceCreation([{ plan: "free" }, { plan: "pro" }]),
    ).toBe("ok");
  });

  it("ödeme sorunu grace penceresindeyse Pro sayılır", () => {
    // Kartı geçmeyen müşteri, Paddle yeniden denerken workspace açma hakkını
    // kaybetmemeli (effectivePlanKey grace kuralı). Zaman damgası ŞİMDİYE
    // göre üretilir — sabit tarih yazılsaydı test bir süre sonra grace
    // penceresi dışına düşüp kırılırdı.
    expect(
      decideWorkspaceCreation([
        { plan: "free" },
        {
          plan: "free",
          paddleSubscriptionStatus: "past_due",
          paddleStatusChangedAt: hoursAgo(24),
        },
      ]),
    ).toBe("ok");
  });
});
