import { describe, expect, it } from "vitest";

import { canonicalizeHeaders, collectAuthorEmails } from "@/lib/db/import";

// Sprint 68.4 — CSV import'un saf (DB'siz) karar noktaları.
//
// Neden: gerçek bir CSV ile koşulmadığı için bu alan "kod var ama doğrulanmadı"
// durumundaydı. Burada hem başlık eşlemesini hem de GERÇEK CSV kanıtlamasında
// bulunan çok-yazarlı hatayı kilitliyoruz.

describe("canonicalizeHeaders — Türkçe + dış araç başlıkları", () => {
  it("kendi export formatımızı eşler", () => {
    expect(
      canonicalizeHeaders(["Başlık", "Açıklama", "Durum", "Tür", "Etiketler"]),
    ).toEqual(["title", "description", "status", "type", "tags"]);
  });

  it("dış araç export'unu (İngilizce takma adlar) eşler", () => {
    expect(
      canonicalizeHeaders(["name", "body", "state", "category", "upvotes", "email"]),
    ).toEqual(["title", "description", "status", "tags", "votes", "author"]);
  });

  it("büyük/küçük harf ve boşlukları hoş görür", () => {
    expect(canonicalizeHeaders(["  TITLE ", "Author_Email"])).toEqual([
      "title",
      "author",
    ]);
  });

  it("tanınmayan başlıkları boş bırakır (sessizce yanlış alana yazmaz)", () => {
    expect(canonicalizeHeaders(["Başlık", "Rastgele"])).toEqual(["title", ""]);
  });
});

describe("collectAuthorEmails — çok yazarlı CSV (68.4'te bulunan hata)", () => {
  // Düzeltmeden önce yalnız İLK satırın yazarı kullanıcı olarak açılıyordu;
  // sonraki yazarların fikirleri "CSV Import" kullanıcısına atfediliyordu.
  it("TÜM satırlardaki benzersiz yazarları toplar, yalnız ilkini değil", () => {
    const rows = [
      ["Fikir A", "ayse@acme.com"],
      ["Fikir B", "mehmet@globex.com"],
      ["Fikir C", "ayse@acme.com"],
      ["Fikir D", "zeynep@initech.com"],
    ];
    expect(collectAuthorEmails(rows, 1)).toEqual([
      "ayse@acme.com",
      "mehmet@globex.com",
      "zeynep@initech.com",
    ]);
  });

  it("e-posta OLMAYAN değerleri atlar (boşuna kullanıcı açmaz)", () => {
    const rows = [["Fikir A", "bilinmiyor"], ["Fikir B", ""], ["Fikir C", "geçerli@x.co"]];
    expect(collectAuthorEmails(rows, 1)).toEqual(["geçerli@x.co"]);
  });

  it("normalize eder (küçük harf, kırpma)", () => {
    const rows = [["A", "  AYSE@Acme.COM "]];
    expect(collectAuthorEmails(rows, 1)).toEqual(["ayse@acme.com"]);
  });

  it("yazar sütunu yoksa boş döner", () => {
    expect(collectAuthorEmails([["A"]], -1)).toEqual([]);
  });
});
