import { describe, expect, it } from "vitest";

import { renderInviteEmail } from "@/lib/email/invite";

// Sprint 61 (Claude #2, KABUL) — davet e-postası şablonu. Konu/metin doğru
// ve HTML HTML-escape içerir (kullanıcı adı/URL enjeksiyonuna karşı).
describe("renderInviteEmail", () => {
  const output = renderInviteEmail({
    inviterName: "Oğuz",
    workspaceName: "Acme",
    inviteUrl: "https://feedl.app/invites/accept?token=abc",
  });

  it("builds a subject with workspace name", () => {
    expect(output.subject).toContain("Acme");
    expect(output.subject).toContain("davet edildin");
  });

  it("contains the invite URL in both text and html", () => {
    expect(output.text).toContain("https://feedl.app/invites/accept?token=abc");
    expect(output.html).toContain("https://feedl.app/invites/accept?token=abc");
  });

  it("escapes HTML in user-provided names", () => {
    const malicious = renderInviteEmail({
      inviterName: "<script>alert(1)</script>",
      workspaceName: "Acme",
      inviteUrl: "https://feedl.app/x",
    });
    expect(malicious.html).not.toContain("<script>alert(1)</script>");
    expect(malicious.html).toContain("&lt;script&gt;");
  });
});
