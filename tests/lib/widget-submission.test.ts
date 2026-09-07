import { describe, expect, it } from "vitest";

// Sprint 63z — widget gönderim modu + anonim kimlik (saf fonksiyonlar).
// submission.ts server-only + DB import eder ama bu testler yalnızca saf
// yardımcıları doğrular (DB'ye dokunmaz).
import { normalizeSubmissionMode } from "@/lib/widget/submission";
import {
  anonymousUserKey,
  anonymousWidgetUserId,
} from "@/lib/widget/submission";
import { toWidgetUserId } from "@/lib/widget/jwt";

describe("normalizeSubmissionMode", () => {
  it("accepts known modes", () => {
    expect(normalizeSubmissionMode("anonymous")).toBe("anonymous");
    expect(normalizeSubmissionMode("email")).toBe("email");
    expect(normalizeSubmissionMode("signup")).toBe("signup");
  });

  it("falls back to signup for unknown/empty (mevcut davranışı korur)", () => {
    expect(normalizeSubmissionMode(undefined)).toBe("signup");
    expect(normalizeSubmissionMode(null)).toBe("signup");
    expect(normalizeSubmissionMode("")).toBe("signup");
    expect(normalizeSubmissionMode("random")).toBe("signup");
    // Mevcut satırlar varchar default 'signup' olduğundan "signup" geçersiz
    // bir değerde muhafaza edilir — DB'de bozuk değer olsa bile güvenli tarafa düşer.
    expect(normalizeSubmissionMode("SIGNUP")).toBe("signup");
  });
});

describe("anonymousWidgetIdentity", () => {
  it("is deterministic per IP (1 IP → 1 kimlik)", () => {
    const key = anonymousUserKey("203.0.113.7");
    expect(anonymousUserKey("203.0.113.7")).toBe(key);
    expect(anonymousWidgetUserId("203.0.113.7")).toBe(toWidgetUserId(key));
  });

  it("differs across IPs", () => {
    expect(anonymousWidgetUserId("203.0.113.7")).not.toBe(
      anonymousWidgetUserId("198.51.100.2"),
    );
  });

  it("prefixes with widget_ for FK compat", () => {
    expect(anonymousWidgetUserId("1.2.3.4").startsWith("widget_")).toBe(true);
  });
});
