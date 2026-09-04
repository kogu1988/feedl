// Sprint 39: sayfalama parametrelerinin ortak ayrıştırması — portal,
// dashboard ve oyladıklarım aynı whitelist'i kullanır (tek kaynak kuralı,
// plan.md Sprint 9 dersi).
export const PAGE_SIZES = ["5", "25", "50", "all"] as const;
export type PerParam = (typeof PAGE_SIZES)[number];

// "Tümü" için makul üst sınır — sınırsız yüklemeye karşı koruma.
export const ALL_PAGE_SIZE = 1000;

export function parsePagination(
  rawPer?: string,
  rawPage?: string,
): { per: PerParam; perSize: number; requestedPage: number } {
  // Geçersiz değer sessizce varsayılana (5) döner.
  const per: PerParam =
    rawPer === "25" || rawPer === "50" || rawPer === "all" ? rawPer : "5";
  const perSize = per === "all" ? ALL_PAGE_SIZE : Number(per);
  const rawPageNumber = Number(rawPage);
  const requestedPage =
    Number.isInteger(rawPageNumber) && rawPageNumber >= 1 ? rawPageNumber : 1;
  return { per, perSize, requestedPage };
}
