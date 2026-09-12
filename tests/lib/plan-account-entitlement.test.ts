import { describe, expect, it } from "vitest";

// 2026-09-12 (kullanıcı kararı) — HESAP DÜZEYİ PRO.
//
// Önceki davranış: etkin plan yalnız AKTİF workspace'in satırından okunuyordu.
// $19'luk abonelik `feedl` workspace'ine bağlı olduğu için, owner olarak açtığı
// yeni workspace'te kullanıcı Free limitleriyle ve "Pro" kilitleriyle
// karşılaşıyordu ("CSV İndir · Pro"). Oysa ek workspace açmak zaten Pro
// hakkıdır; içinde Pro'yu kilitlemek kendi içinde çelişkiliydi.
//
// Kural: SAHİBİ olduğun bir workspace Pro ise, sahibi olduğun TÜM
// workspace'lerde Pro'sun. Başkasının workspace'ine `member` olarak
// eklendiysen kendi Pro'n DEVRALINMAZ — orayı ödeyen onun owner'ıdır.
import { resolveAccountPlanKey, type PlanKey } from "@/lib/paddle";

type Row = {
  id: string;
  plan?: string | null;
  paddleSubscriptionStatus?: string | null;
  paddleStatusChangedAt?: Date | string | null;
};

const NOW = new Date("2026-09-12T00:00:00Z");

const currentFree: Row = { id: "ws-current", plan: "free" };
const currentPro: Row = { id: "ws-current", plan: "pro" };
const otherPro: Row = { id: "ws-other", plan: "pro" };
const otherFree: Row = { id: "ws-other", plan: "free" };

function resolve(
  current: Row,
  owned: Row[],
  currentId = current.id,
): PlanKey {
  return resolveAccountPlanKey(current, owned, currentId, NOW);
}

describe("resolveAccountPlanKey — hesap düzeyi Pro", () => {
  it("aktif workspace Pro ise Pro (mevcut davranış korunur)", () => {
    expect(resolve(currentPro, [currentPro])).toBe("pro");
  });

  it("owner olduğum BAŞKA bir workspace Pro ise bu workspace de Pro olur", () => {
    // Kullanıcının asıl şikâyeti: yeni açtığı workspace'te Pro kilitleri.
    expect(resolve(currentFree, [currentFree, otherPro])).toBe("pro");
  });

  it("sahibi olduğum hiçbir workspace Pro değilse Free", () => {
    expect(resolve(currentFree, [currentFree, otherFree])).toBe("free");
  });

  it("DEVRALMA YOK: member olduğum workspace'te kendi Pro'm işlemez", () => {
    // current, owned listesinde YOK → başkasının workspace'indeyim.
    expect(resolve(currentFree, [otherPro], "ws-baskasi")).toBe("free");
  });

  it("member olduğum workspace'in kendisi Pro ise Pro (onun owner'ı ödedi)", () => {
    const memberView: Row = { id: "ws-baskasi", plan: "pro" };
    expect(resolve(memberView, [otherPro], "ws-baskasi")).toBe("pro");
  });

  it("dunning grace sahibi olduğum Pro workspace'te korunur", () => {
    const dunning = {
      id: "ws-other",
      plan: "free",
      paddleSubscriptionStatus: "past_due",
      paddleStatusChangedAt: "2026-09-10T00:00:00Z", // 2 gün önce (< 7 gün)
    };
    expect(resolve(currentFree, [currentFree, dunning])).toBe("pro");
  });

  it("dunning grace dolmuşsa Free'ye düşer", () => {
    const dunning = {
      id: "ws-other",
      plan: "free",
      paddleSubscriptionStatus: "past_due",
      paddleStatusChangedAt: "2026-08-01T00:00:00Z", // 42 gün önce
    };
    expect(resolve(currentFree, [currentFree, dunning])).toBe("free");
  });

  it("aktif workspace'in kendi satırı yoksa Free'ye güvenli düşer", () => {
    expect(
      resolveAccountPlanKey({ id: "ws-bilinmeyen" }, [currentFree], "ws-bilinmeyen", NOW),
    ).toBe("free");
  });
});
