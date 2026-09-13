import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

// 2026-09-12 (teknik borç #21) — middleware public allowlist'i.
//
// `createRouteMatcher` deprecated olduğu için açık bir allowlist'e geçildi.
// Kritik özellik FAIL-CLOSED olması: listede olmayan her yol korunur. Buradaki
// testler hem gerçekten public kalması gereken yüzeyleri hem de "önek sızması"
// sınıfını (ör. "/api/adminx" açılmamalı) sabitler.

describe("isPublicPath — public yüzeyler", () => {
  it("kök ve tek segmentli public sayfalar", () => {
    for (const p of [
      "/",
      // 2026-09-13: sayfası KALDIRILDI ama ana sayfaya 308 yönlendirdiği için
      // public kalır (aksi halde eski bağlantılar Clerk oturumuna düşerdi).
      "/pricing",
      "/alternative",
      "/how-to-collect-feedback",
      "/how-to-use-feedl",
      "/demo",
      // Ürün-dışı araştırma anketi (kök host'a kapılı + noindex).
      "/survey",
      "/privacy",
      "/terms",
      "/refund",
      "/contact",
      "/robots.txt",
      "/sitemap.xml",
      "/widget",
      // Uptime monitörü: Clerk oturumu taşıyamaz (2026-09-12, denetim #8).
      "/api/health",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("public öneklerin alt yolları", () => {
    for (const p of [
      "/sign-in/factor-one",
      "/sign-up/verify-email-address",
      "/portal",
      "/portal/oyladiklarim",
      "/portal/11111111-1111-4111-8111-111111111111",
      "/roadmap",
      "/changelog",
      "/changelog/2026-09",
      "/invites/accept",
      "/api/posts",
      "/api/posts/abc",
      "/api/v1/posts",
      "/api/widget/posts",
      "/api/webhooks/clerk",
      "/api/webhooks/paddle",
      "/api/paddle/status",
      "/api/visual-feedback/xyz",
      "/api/integrations/linear/webhook",
      "/api/integrations/slack/events",
      "/api/inngest",
      "/api/changelog/subscribe",
      "/api/unsubscribe",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("handler auth'u olan API namespace'leri public listede (JSON 401 dönebilsinler)", () => {
    for (const p of [
      "/api/admin/members",
      "/api/admin/workspace/verify-domain",
      "/api/comments/11111111-1111-4111-8111-111111111111",
      "/api/corpus-insights",
      "/api/invites/accept",
      "/api/onboarding",
      "/api/votes",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("sondaki eğik çizgiyi hoş görür (kök hariç)", () => {
    expect(isPublicPath("/pricing/")).toBe(true);
    expect(isPublicPath("/api/posts/")).toBe(true);
    // Kök "/" olarak kalmalı; normalize boş string üretmemeli.
    expect(isPublicPath("/")).toBe(true);
  });
});

describe("isPublicPath — FAIL-CLOSED (listede yoksa korunur)", () => {
  it("dashboard ve onboarding korunur", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/insights",
      "/dashboard/billing",
      "/dashboard/members",
      "/dashboard/workspaces",
      "/onboarding",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("bilinmeyen/korunması gereken API yolları", () => {
    for (const p of ["/api/keys", "/api/me", "/api/billing", "/api/settings"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("ÖNEK SIZMASI yok: benzer isimli yollar açılmaz", () => {
    // `createRouteMatcher`'ın "/x(.*)" deseninde olduğu gibi "/api/adminx"
    // kazara açılmamalı — segment sınırı şart.
    for (const p of [
      "/api/adminx",
      "/api/paddlex",
      "/api/v1x",
      "/api/widgetx",
      "/api/postsx",
      "/portalx",
      "/widgets",
      "/pricing-page",
      "/demos",
      "/changelogs",
      // Sağlık ucunun BENZERİ açılmamalı (önek sızması).
      "/api/healthz",
      "/health",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("korunan yolda sondaki eğik çizgi kapıyı AÇMAZ", () => {
    expect(isPublicPath("/dashboard/")).toBe(false);
  });
});
