import { describe, expect, it } from "vitest";

import { isVercelDnsTarget } from "@/lib/vercel-domains";

// 2026-09-12 — custom domain'in TRAFİK yarısı.
//
// Bu fonksiyon "müşterinin CNAME'i bize mi bakıyor?" sorusunu cevaplar.
// Gevşek bir eşleşme burada gerçek bir güvenlik hatasıdır: saldırgan kendi
// domain'ini `vercel-dns.com.saldirgan.net` gibi bir hedefe çevirip "trafik
// hazır" dedirtebilir. Test hem kabul hem RED tarafını kilitler.

describe("isVercelDnsTarget", () => {
  it("Vercel hedeflerini kabul eder", () => {
    expect(isVercelDnsTarget("cname.vercel-dns.com")).toBe(true);
    expect(isVercelDnsTarget("abc123.vercel-dns-017.com")).toBe(true);
    expect(isVercelDnsTarget("vercel-dns.com")).toBe(true);
    expect(isVercelDnsTarget("  CNAME.VERCEL-DNS.COM  ")).toBe(true);
  });

  it("Vercel'e benzeyen ama olmayan hedefleri REDDEDER", () => {
    // Sonda çapa olmasaydı bu ilk üçü geçerdi.
    expect(isVercelDnsTarget("vercel-dns.com.saldirgan.net")).toBe(false);
    expect(isVercelDnsTarget("cname.vercel-dns.com.evil.io")).toBe(false);
    expect(isVercelDnsTarget("notvercel-dns.com")).toBe(false);
    expect(isVercelDnsTarget("example.com")).toBe(false);
    expect(isVercelDnsTarget("")).toBe(false);
  });
});
