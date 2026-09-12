import { describe, expect, it } from "vitest";

// 2026-09-12 (kullanıcı kararı) — HESAP DÜZEYİ PRO.
//
// Önceki davranış: etkin plan yalnız AKTİF workspace'in satırından okunuyordu.
// $19'luk abonelik `feedl` workspace'ine bağlı olduğu için, owner olarak açtığı
// yeni workspace'te kullanıcı Free limitleriyle ve "Pro" kilitleriyle
// karşılaşıyordu ("CSV İndir · Pro"). Oysa ek workspace açmak zaten Pro
// hakkıdır; içinde Pro'yu kilitlemek kendi içinde çelişkiliydi.
//
// Kural: bu workspace'in OWNER'larından birinin sahip olduğu BAŞKA bir
// workspace Pro ise bu workspace de Pro'dur.
//
// DEVRALMA YOK: başkasının workspace'ine `member` olarak eklendiysen kendi
// Pro'n oraya işlemez — kararı o workspace'in OWNER'ı verir. Kural "viewer"
// yerine "owner" üzerinden kurulduğu için public sayfalar Clerk oturumu sormaz.
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

function resolve(current: Row, ownedByOwners: Row[]): PlanKey {
  return resolveAccountPlanKey(current, ownedByOwners, NOW);
}

describe("resolveAccountPlanKey — hesap düzeyi Pro (owner tabanlı)", () => {
  it("aktif workspace Pro ise Pro (mevcut davranış korunur)", () => {
    expect(resolve(currentPro, [currentPro])).toBe("pro");
  });

  it("owner'ın BAŞKA bir Pro workspace'i varsa bu workspace de Pro olur", () => {
    // Kullanıcının asıl şikâyeti: yeni açtığı workspace'te Pro kilitleri.
    expect(resolve(currentFree, [currentFree, otherPro])).toBe("pro");
  });

  it("owner'ın yalnız bu (Free) workspace'i varsa Free", () => {
    expect(resolve(currentFree, [currentFree])).toBe("free");
    expect(resolve(currentFree, [currentFree, otherFree])).toBe("free");
  });

  it("DEVRALMA YOK: member olduğum workspace'in owner'ı Pro değilse Free", () => {
    // Ben (Pro sahibi) başkasının workspace'ine member'ım. Bu workspace'in
    // owner'ının sahip olduğu tek workspace bu Free olan → Free. Benim kendi
    // Pro workspace'im bu listeye GİRMEZ (owner ben değilim).
    expect(resolve(currentFree, [currentFree])).toBe("free");
  });

  it("member olduğum workspace'in kendisi Pro ise Pro (onun owner'ı ödedi)", () => {
    const memberView: Row = { id: "ws-baskasi", plan: "pro" };
    expect(resolve(memberView, [memberView])).toBe("pro");
  });

  it("owner'ın diğer workspace'i dunning grace içindeyse Pro", () => {
    const dunning: Row = {
      id: "ws-other",
      plan: "free",
      paddleSubscriptionStatus: "past_due",
      paddleStatusChangedAt: "2026-09-10T00:00:00Z", // 2 gün önce (< 7 gün)
    };
    expect(resolve(currentFree, [currentFree, dunning])).toBe("pro");
  });

  it("owner'ın diğer workspace'inde grace dolmuşsa Free", () => {
    const dunning: Row = {
      id: "ws-other",
      plan: "free",
      paddleSubscriptionStatus: "past_due",
      paddleStatusChangedAt: "2026-08-01T00:00:00Z", // 42 gün önce
    };
    expect(resolve(currentFree, [currentFree, dunning])).toBe("free");
  });

  it("aktif workspace'in kendi satırı yoksa Free'ye güvenli düşer", () => {
    expect(resolve({ id: "ws-bilinmeyen" }, [currentFree])).toBe("free");
  });

  it("owner listesi boşsa (yetim workspace) Free", () => {
    expect(resolve(currentFree, [])).toBe("free");
  });
});
