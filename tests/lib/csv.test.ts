import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";

// Sprint 61 (Claude #2, KABUL) — CSV import'un temel parser'ı. RFC 4180:
// BOM, virgül/tırnak/yeni satır içeren alanlar, tırnak kaçışı ve boş satırlar.
describe("parseCsv", () => {
  it("strips the BOM and parses headers + rows", () => {
    const { headers, rows } = parseCsv("\uFEFFBaşlık,Açıklama\r\nA,B\r\n");
    expect(headers).toEqual(["Başlık", "Açıklama"]);
    expect(rows).toEqual([["A", "B"]]);
  });

  it("handles quoted fields with commas", () => {
    const { rows } = parseCsv("a,b\n\"Dark mode, please\",x\n");
    expect(rows[0]).toEqual(["Dark mode, please", "x"]);
  });

  it("handles quoted fields with newlines", () => {
    const { rows } = parseCsv("a,b\n\"line1\nline2\",y\n");
    expect(rows[0]).toEqual(["line1\nline2", "y"]);
  });

  it("handles escaped quotes inside a quoted field", () => {
    const { rows } = parseCsv('a,b\n"he said ""hi""",z\n');
    expect(rows[0]).toEqual(['he said "hi"', "z"]);
  });

  it("skips blank trailing rows and supports mixed line endings", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n3,4\n\n");
    expect(rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("returns empty headers/rows for empty input", () => {
    const { headers, rows } = parseCsv("");
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });
});
