import { describe, expect, it } from "vitest";

// Sprint 63v — Resend teslimat olay eşleme + hard-bounce tespiti (saf).
import { deriveEmailStatus, marksSuppressed } from "@/lib/email/deliverability";

describe("deriveEmailStatus", () => {
  it("maps known Resend event types", () => {
    expect(deriveEmailStatus("email.sent")).toBe("sent");
    expect(deriveEmailStatus("email.received")).toBe("delivered");
    expect(deriveEmailStatus("email.delivered")).toBe("delivered");
    expect(deriveEmailStatus("email.failed")).toBe("bounced");
    expect(deriveEmailStatus("email.bounced")).toBe("bounced");
    expect(deriveEmailStatus("email.complained")).toBe("complained");
  });

  it("returns null for unknown events", () => {
    expect(deriveEmailStatus("email.clicked")).toBeNull();
    expect(deriveEmailStatus("")).toBeNull();
    expect(deriveEmailStatus("unknown")).toBeNull();
  });
});

describe("marksSuppressed", () => {
  it("suppresses on spam complaint", () => {
    expect(marksSuppressed("email.complained", null)).toBe(true);
  });

  it("suppresses on hard bounce (bounced type or missing)", () => {
    expect(marksSuppressed("email.bounced", "bounced")).toBe(true);
    expect(marksSuppressed("email.bounced", null)).toBe(true);
  });

  it("does not suppress on transient (soft) bounce", () => {
    expect(marksSuppressed("email.bounced", "transient")).toBe(false);
    expect(marksSuppressed("email.bounced", "complained")).toBe(false);
  });

  it("does not suppress on email.failed (may be transient)", () => {
    expect(marksSuppressed("email.failed", null)).toBe(false);
  });

  it("does not suppress on deliver/sent", () => {
    expect(marksSuppressed("email.delivered", null)).toBe(false);
    expect(marksSuppressed("email.sent", null)).toBe(false);
  });
});
