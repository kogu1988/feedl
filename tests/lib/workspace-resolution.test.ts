import { describe, expect, it } from "vitest";

// Sprint 63i (test derinleştirme) — workspace izolasyonu (saf host→slug).
// Bu, çok kiracılı routing'in özüdür: alt alan adı kendi workspace'sine,
// kök feedl host'lar varsayılana düşer. workspace.ts modülü server-only +
// next/headers import eder ama bu fonksiyonlar saf (headers'e dokunmaz).
import { isFeedlRootHost, slugFromHost } from "@/lib/db/workspace";

describe("isFeedlRootHost", () => {
  it("recognizes feedl.app and www as root", () => {
    expect(isFeedlRootHost("feedl.app")).toBe(true);
    expect(isFeedlRootHost("www.feedl.app")).toBe(true);
  });

  it("rejects a tenant subdomain", () => {
    expect(isFeedlRootHost("acme.feedl.app")).toBe(false);
  });
});

describe("slugFromHost", () => {
  it("maps root hosts to the default slug", () => {
    expect(slugFromHost("feedl.app")).toBe("feedl");
    expect(slugFromHost("www.feedl.app")).toBe("feedl");
    expect(slugFromHost("feedl.app:3000")).toBe("feedl");
  });

  it("maps a subdomain to its own slug (tenant isolation)", () => {
    expect(slugFromHost("acme.feedl.app")).toBe("acme");
    expect(slugFromHost("beta.feedl.app")).toBe("beta");
  });

  it("falls back to default for unknown/edge hosts", () => {
    // Tek parçalı / boş / 'feedl.app' dışı iki parçalı host → varsayılan.
    expect(slugFromHost("localhost")).toBe("feedl");
    expect(slugFromHost("example.com")).toBe("feedl");
  });
});
