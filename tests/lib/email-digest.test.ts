import { describe, expect, it } from "vitest";

import {
  DIGEST_MIN_INTERVAL_MS,
  renderDigestEmail,
  shouldSendDigest,
  type DigestInsights,
} from "@/lib/email/digest";

const NOW = new Date("2026-09-10T06:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

const INSIGHTS: DigestInsights = {
  themes: [
    { name: "Bildirimler", count: 4, summary: "E-posta bildirimleri isteniyor." },
  ],
  trends: [{ name: "Mobil", note: "Mobil şikâyetleri artıyor." }],
  quickWins: ["Boş durum metnini netleştir"],
  risks: [{ label: "Ödeme", detail: "Ödeme akışında tekrarlayan hata." }],
  recommendation: "Önce mobil yerleşim düzeltilmeli.",
};

describe("shouldSendDigest", () => {
  it("yalnız pro plana gönderir", () => {
    expect(
      shouldSendDigest({
        plan: "free",
        enabled: true,
        lastSentAt: null,
        newPostCount: 5,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("tercih kapalıysa göndermez", () => {
    expect(
      shouldSendDigest({
        plan: "pro",
        enabled: false,
        lastSentAt: null,
        newPostCount: 5,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("yeni geri bildirim yoksa boş özet göndermez", () => {
    expect(
      shouldSendDigest({
        plan: "pro",
        enabled: true,
        lastSentAt: daysAgo(7),
        newPostCount: 0,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("iki gönderim arası asgari aralığa uyar", () => {
    expect(
      shouldSendDigest({
        plan: "pro",
        enabled: true,
        lastSentAt: new Date(NOW.getTime() - DIGEST_MIN_INTERVAL_MS + 60_000),
        newPostCount: 3,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("pro + açık + yeni geri bildirim + yeterli aralık → gönderir", () => {
    expect(
      shouldSendDigest({
        plan: "pro",
        enabled: true,
        lastSentAt: daysAgo(7),
        newPostCount: 3,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("hiç gönderilmemişse (lastSentAt null) gönderir", () => {
    expect(
      shouldSendDigest({
        plan: "pro",
        enabled: true,
        lastSentAt: null,
        newPostCount: 1,
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("renderDigestEmail", () => {
  const base = {
    workspaceName: "Acme",
    insights: INSIGHTS,
    inboxUrl: "https://feedl.app/dashboard/insights",
    newPostCount: 7,
    totalPostCount: 42,
  };

  it("konu satırında yeni fikir sayısını taşır", () => {
    const { subject } = renderDigestEmail(base);
    expect(subject).toContain("7 yeni geri bildirim");
  });

  it("öneri, tema, hızlı kazanım, risk ve trendi HTML'e koyar", () => {
    const { html } = renderDigestEmail(base);
    expect(html).toContain("Önce mobil yerleşim düzeltilmeli.");
    expect(html).toContain("Bildirimler");
    expect(html).toContain("Boş durum metnini netleştir");
    expect(html).toContain("Ödeme");
    expect(html).toContain("Mobil");
    expect(html).toContain("https://feedl.app/dashboard/insights");
  });

  it("kullanıcı içeriğini HTML'e kaçışlayarak basar (XSS guard)", () => {
    const { html } = renderDigestEmail({
      ...base,
      insights: {
        ...INSIGHTS,
        themes: [
          {
            name: "<script>alert(1)</script>",
            count: 1,
            summary: 'a " b & c',
          },
        ],
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("boş bölümleri tamamen atlar", () => {
    const { html } = renderDigestEmail({
      ...base,
      insights: {
        themes: [],
        trends: [],
        quickWins: [],
        risks: [],
        recommendation: "",
      },
    });
    expect(html).not.toContain("Temalar");
    expect(html).not.toContain("Hızlı kazanımlar");
    expect(html).not.toContain("Riskler");
    expect(html).not.toContain("Trendler");
    // Yine de gövde ve CTA kalır.
    expect(html).toContain("haftalık özeti");
  });

  it("unsubscribe linkini yalnız verildiğinde koyar", () => {
    const without = renderDigestEmail(base);
    expect(without.html).not.toContain("/api/unsubscribe");
    expect(without.text).not.toContain("/api/unsubscribe");

    const withUrl = renderDigestEmail({
      ...base,
      unsubscribeUrl: "https://feedl.app/api/unsubscribe?token=t&type=digest",
    });
    expect(withUrl.html).toContain("/api/unsubscribe");
    expect(withUrl.html).toContain("Haftalık özeti kapat");
    expect(withUrl.text).toContain("Haftalık özeti kapat:");
  });

  it("düz metin sürümü aynı bilgiyi taşır", () => {
    const { text } = renderDigestEmail(base);
    expect(text).toContain("Acme haftalık özeti");
    expect(text).toContain("Önce mobil yerleşim düzeltilmeli.");
    expect(text).toContain("Bildirimler (4 istek)");
    expect(text).toContain("İçgörüleri aç:");
  });
});
