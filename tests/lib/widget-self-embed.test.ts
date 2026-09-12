import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-12 (kullanıcı kararı) — self-embed KAPILARI.
//
// Canlı hata: owner olarak `/roadmap`'ten `/portal`'a ve `/dashboard`'a
// geçildiğinde widget "hayalet" olarak kalıyordu. Yaşam döngüsü client'ta
// çözüldü (e2e kapsar); bu dosya SUNUCU kapılarını sabitler:
//   1) host kapısı   — müşteri domain'lerinde widget feedl'in panosuna yazmasın
//   2) oturum kapısı — girişli workspace üyesi (operatör) widget'ı görmesin
//   3) istek bağlamı yoksa (build/prerender) fail-closed → hiç çözülmesin

const h = vi.hoisted(() => ({
  showcase: true,
  teamUserId: null as string | null,
  teamThrows: false,
  host: "feedl.app" as string | null,
  workspaceRow: { slug: "feedl", brandColor: null as string | null } as
    | { slug: string; brandColor: string | null }
    | undefined,
  planKey: "free" as "free" | "pro",
}));

vi.mock("@/lib/db/workspace", () => ({
  isShowcaseRequest: async () => h.showcase,
  getWorkspaceId: async () => "ws-1",
}));

vi.mock("@/lib/auth/admin", () => ({
  getTeamUserId: async () => {
    if (h.teamThrows) throw new Error("no request context");
    return h.teamUserId;
  },
}));

vi.mock("@/lib/paddle", () => ({
  getPlanLimits: async () => ({ key: h.planKey }),
}));

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: async () => (h.workspaceRow ? [h.workspaceRow] : []),
  };
  return { getDb: () => ({ select: () => chain }) };
});

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-host"
        ? h.host
        : name === "x-forwarded-proto"
          ? "https"
          : null,
  }),
}));

import { resolveFeedlSelfEmbed } from "@/components/custom/feedl-widget-self-embed";

beforeEach(() => {
  h.showcase = true;
  h.teamUserId = null;
  h.teamThrows = false;
  h.host = "feedl.app";
  h.workspaceRow = { slug: "feedl", brandColor: null };
  h.planKey = "free";
});

describe("resolveFeedlSelfEmbed — self-embed kapıları", () => {
  it("kök host + anonim ziyaretçi → widget çözülür", async () => {
    const config = await resolveFeedlSelfEmbed();
    expect(config).not.toBeNull();
    expect(config?.workspace).toBe("feedl");
    expect(config?.src).toBe("https://feedl.app/widget.js");
    // Free: data-accent YAZILMAZ (widget varsayılanı = feedl marka rengi).
    expect(config?.accent).toBeNull();
  });

  it("HOST KAPISI: müşteri domain'inde/subdomain'de çözülmez", async () => {
    h.showcase = false;
    expect(await resolveFeedlSelfEmbed()).toBeNull();
  });

  it("OTURUM KAPISI: girişli workspace üyesi (owner dahil) widget'ı GÖRMEZ", async () => {
    h.teamUserId = "user_owner";
    expect(await resolveFeedlSelfEmbed()).toBeNull();
  });

  it("istek bağlamı yoksa (build/prerender) fail-closed → çözülmez", async () => {
    h.teamThrows = true;
    expect(await resolveFeedlSelfEmbed()).toBeNull();
  });

  it("host başlığı yoksa çözülmez", async () => {
    h.host = null;
    expect(await resolveFeedlSelfEmbed()).toBeNull();
  });

  it("workspace satırı yoksa çözülmez", async () => {
    h.workspaceRow = undefined;
    expect(await resolveFeedlSelfEmbed()).toBeNull();
  });

  it("Pro + özel renk → data-accent çözülür", async () => {
    h.planKey = "pro";
    h.workspaceRow = { slug: "feedl", brandColor: "#1e01f9" };
    const config = await resolveFeedlSelfEmbed();
    expect(config?.accent).toBe("#1e01f9");
  });
});
