import { describe, expect, it } from "vitest";

// 2026-09-12 kod incelemesi — custom domain sahiplik doğrulamasının SAF
// parçaları. Buradaki biçim kontrolü GÜVENLİK SINIRIDIR: eskiden hiç
// doğrulama yoktu, herhangi bir workspace owner'ı herhangi bir string'i
// (path'li, boşluklu, IP, hatta feedl.app alt alanı) custom domain olarak
// kaydedebiliyordu.
import {
  domainVerificationRecordName,
  domainVerificationRecordValue,
  generateDomainVerificationToken,
  isReservedHost,
  isValidCustomDomain,
  normalizeCustomDomain,
} from "@/lib/custom-domain";

describe("normalizeCustomDomain", () => {
  it("protokol, path, port, büyük harf ve kök noktasını temizler", () => {
    expect(normalizeCustomDomain("https://Feedback.Acme.com/portal")).toBe(
      "feedback.acme.com",
    );
    expect(normalizeCustomDomain("http://acme.com:3000")).toBe("acme.com");
    expect(normalizeCustomDomain("  ACME.com.  ")).toBe("acme.com");
  });

  it("baştaki www'yi düşürür (teklik indeksi anlamlı kalsın)", () => {
    expect(normalizeCustomDomain("www.feedback.acme.com")).toBe(
      "feedback.acme.com",
    );
  });
});

describe("isValidCustomDomain", () => {
  it("geçerli hostname'leri kabul eder", () => {
    expect(isValidCustomDomain("feedback.acme.com")).toBe(true);
    expect(isValidCustomDomain("feedback.acme.co.uk")).toBe(true);
    expect(isValidCustomDomain("f-1.acme.io")).toBe(true);
  });

  it("bozuk girdileri reddeder", () => {
    expect(isValidCustomDomain("acme")).toBe(false); // tek etiket
    expect(isValidCustomDomain("acme .com")).toBe(false); // boşluk
    expect(isValidCustomDomain("-acme.com")).toBe(false); // baş tire
    expect(isValidCustomDomain("acme-.com")).toBe(false); // son tire
    expect(isValidCustomDomain("acme_com")).toBe(false); // alt çizgi
    expect(isValidCustomDomain("acme.com/path")).toBe(false); // path
    expect(isValidCustomDomain("1.2.3.4")).toBe(false); // IP
  });

  it("feedl.app ve alt alan adlarını reddeder (kendi host'larımız)", () => {
    expect(isReservedHost("feedl.app")).toBe(true);
    expect(isReservedHost("acme.feedl.app")).toBe(true);
    expect(isReservedHost("acme.com")).toBe(false);
    expect(isValidCustomDomain("acme.feedl.app")).toBe(false);
  });
});

describe("doğrulama kaydı", () => {
  it("TXT adı/değeri ve token üretimi", () => {
    const token = generateDomainVerificationToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(domainVerificationRecordName("feedback.acme.com")).toBe(
      "_feedl.feedback.acme.com",
    );
    expect(domainVerificationRecordValue(token)).toBe(`feedl-verify=${token}`);
  });

  it("her çağrıda yeni token üretir", () => {
    expect(generateDomainVerificationToken()).not.toBe(
      generateDomainVerificationToken(),
    );
  });
});
