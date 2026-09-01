// E-posta şablonları için ortak HTML kaçış yardımcısı — shipped ve
// admin bildirim şablonları aynı kaynağı kullanır (plan.md Sprint 18).

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
