import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isVercelDnsTarget,
  isVercelApexIp,
  dnsPointsToVercel,
  getDomainDnsRecommendation,
} from "@/lib/vercel-domains";
import { isApexDomain } from "@/lib/dns-records";

// 2026-09-12 — custom domain'in TRAFİK yarısı.
//
// Bu fonksiyonlar "müşterinin DNS'i bize mi bakıyor?" sorusunu cevaplar ve
// hangi kaydın istendiğini (A vs CNAME) belirler.
//
// Gevşek bir eşleşme burada gerçek bir güvenlik hatasıdır: saldırgan kendi
// domain'ini `vercel-dns.com.saldirgan.net` gibi bir hedefe çevirip "trafik
// hazır" dedirtebilir. Test hem kabul hem RED tarafını kilitler.
//
// APEX (2026-09-12'de eklendi): apex'te CNAME standart olarak yasaktır, A
// kaydı gerekir. Öncesinde yalnız CNAME kontrol edildiği için apex domain'lerde
// trafik durumu ASLA "hazır" görünmüyordu — aşağıdaki testler o regresyonu
// kilitler.

const h = vi.hoisted(() => ({
  cname: [] as string[],
  cnameThrows: false,
  a: [] as string[],
  aThrows: false,
}));

vi.mock("node:dns/promises", () => ({
  resolveCname: async () => {
    if (h.cnameThrows) throw new Error("ENODATA");
    return h.cname;
  },
  resolve4: async () => {
    if (h.aThrows) throw new Error("ENODATA");
    return h.a;
  },
}));

beforeEach(() => {
  h.cname = [];
  h.cnameThrows = false;
  h.a = [];
  h.aThrows = false;
  // Testte Vercel API'sine gidilmesin (yedek sabitler yeterli).
  delete process.env.VERCEL_API_TOKEN;
});

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

describe("isVercelApexIp", () => {
  it("bilinen Vercel A kaydı IP'lerini kabul eder", () => {
    expect(isVercelApexIp("76.76.21.21")).toBe(true);
    expect(isVercelApexIp(" 76.76.21.21 ")).toBe(true);
  });

  it("yabancı IP'leri reddeder", () => {
    expect(isVercelApexIp("1.2.3.4")).toBe(false);
    expect(isVercelApexIp("76.76.21.22")).toBe(false);
  });
});

describe("isApexDomain", () => {
  it("kök alan adlarını apex sayar", () => {
    expect(isApexDomain("acme.com")).toBe(true);
    expect(isApexDomain("ACME.COM")).toBe(true);
    expect(isApexDomain("acme.com.")).toBe(true);
  });

  it("çok etiketli public suffix'lerde de apex'i doğru bulur", () => {
    // Naive "3 etiket = subdomain" kuralı bunları yanlış sınıflardı.
    expect(isApexDomain("acme.com.tr")).toBe(true);
    expect(isApexDomain("acme.co.uk")).toBe(true);
  });

  it("subdomain'leri apex SAYMAZ", () => {
    expect(isApexDomain("feedback.acme.com")).toBe(false);
    expect(isApexDomain("feedback.acme.com.tr")).toBe(false);
    expect(isApexDomain("cekici.acme.co.uk")).toBe(false);
  });

  it("geçersiz girdide false", () => {
    expect(isApexDomain("")).toBe(false);
    expect(isApexDomain("localhost")).toBe(false);
    expect(isApexDomain("acme.com:3000")).toBe(false);
    expect(isApexDomain("https://acme.com")).toBe(false);
  });
});

describe("getDomainDnsRecommendation (Vercel API yokken yedek)", () => {
  it("apex → A kaydı hedefi, cname null", async () => {
    const rec = await getDomainDnsRecommendation("acme.com");
    expect(rec.apex).toBe(true);
    expect(rec.cname).toBeNull();
    expect(rec.ipv4).toContain("76.76.21.21");
    expect(rec.fromVercel).toBe(false);
  });

  it("subdomain → CNAME hedefi, ipv4 boş", async () => {
    const rec = await getDomainDnsRecommendation("feedback.acme.com");
    expect(rec.apex).toBe(false);
    expect(rec.cname).toBe("cname.vercel-dns.com");
    expect(rec.ipv4).toEqual([]);
  });
});

describe("dnsPointsToVercel", () => {
  it("subdomain: CNAME Vercel'e bakıyorsa true", async () => {
    h.cname = ["cname.vercel-dns.com"];
    await expect(dnsPointsToVercel("feedback.acme.com")).resolves.toBe(true);
  });

  it("subdomain: yabancı CNAME → false", async () => {
    h.cname = ["baska.example.com"];
    await expect(dnsPointsToVercel("feedback.acme.com")).resolves.toBe(false);
  });

  it("subdomain: yalnız A kaydı varsa false (CNAME beklenir)", async () => {
    h.cnameThrows = true;
    h.a = ["76.76.21.21"];
    await expect(dnsPointsToVercel("feedback.acme.com")).resolves.toBe(false);
  });

  it("APEX: A kaydı Vercel IP'sine bakıyorsa true (REGRESYON: eskiden hiç true olmazdı)", async () => {
    h.cnameThrows = true;
    h.a = ["76.76.21.21"];
    await expect(dnsPointsToVercel("acme.com")).resolves.toBe(true);
  });

  it("APEX: yabancı A kaydı → false", async () => {
    h.cnameThrows = true;
    h.a = ["1.2.3.4"];
    await expect(dnsPointsToVercel("acme.com")).resolves.toBe(false);
  });

  it("APEX: CNAME düzleştirilmişse (flattening) yine true", async () => {
    h.cname = ["cname.vercel-dns.com"];
    await expect(dnsPointsToVercel("acme.com")).resolves.toBe(true);
  });
});
