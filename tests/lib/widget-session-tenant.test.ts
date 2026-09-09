import { describe, expect, it, beforeEach } from "vitest";

// P0-4: Widget tenant izolasyonu — widget oturum jetonu, MÜŞTERİ SİTESİNİN
// workspace slug'ını (data-feedl-workspace="acme") taşır ve doğrulanınca
// korur. getWorkspaceId bu `ws` claim'ini host'tan ÖNCE tercih eder; böylece
// acme.com'a gömülü bir widget, host ne olursa olsun acme workspace'ine düşer.
// Aksi halde feedl.app varsayılan workspace'ine (A) kaçar — veri sızıntısı.
import { signSessionToken, verifySessionPayload } from "@/lib/widget/jwt";

beforeEach(() => {
  process.env.FEEDL_WIDGET_SECRET = "test_widget_secret_at_least_16_chars";
});

describe("widget session tenant binding", () => {
  it("round-trips the workspace slug so a widget stays in its own tenant", () => {
    const token = signSessionToken("widget_user_acme", "https://acme.com", "acme");
    const session = verifySessionPayload(token);
    expect(session?.workspaceSlug).toBe("acme");
    expect(session?.origin).toBe("https://acme.com");
  });

  it("does not bind to a host-derived slug when none is provided (null remains)", () => {
    const token = signSessionToken("widget_user_anon", "https://acme.com", null);
    const session = verifySessionPayload(token);
    // ws claim yok → getWorkspaceId host/çereze düşer; tenant burada zorlanmaz.
    expect(session?.workspaceSlug).toBeNull();
  });

  it("rejects a token signed with a different secret (no cross-tenant forgery)", () => {
    const token = signSessionToken("widget_user_a", "https://a.com", "a");
    process.env.FEEDL_WIDGET_SECRET = "another_secret_at_least_16_chars";
    const session = verifySessionPayload(token);
    expect(session).toBeNull();
  });
});
