// E-posta şablonları için ortak HTML kaçış yardımcısı — shipped ve
// admin bildirim şablonları aynı kaynağı kullanır (plan.md Sprint 18).
// Sprint 46: tek yönlü bildirim notu — alıcıya bu e-postanın tek yönlü
// olduğu ve yanıtın izlenmediği, geri bildirimin nereye (hi@feedl.app)
// iletileceği açıkça söylenir (spam bildirimini azaltır, güveni artırır).

// Kullanıcının kurumsal/support e-posta adresi (Squarespace yönlendirmesiyle
// kişisel adrese iletilir).
export const SUPPORT_EMAIL = "hi@feedl.app";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// HTML footer bloğu: tek yönlü bildirim + destek adresi. Var olan her
// şablonun footer <td> içine eklenir.
export function oneWayFooterHtml(): string {
  return `<span style="white-space:nowrap;">Bu e-posta tek yönlü bir bilgilendirmedir — bu e-postaya yanıt vermek bize ulaşmaz. Geri bildirim için <a href="https://feedl.app/portal" style="color:#71717a;">feedl&#39;e yazın</a> ya da <a href="mailto:${SUPPORT_EMAIL}" style="color:#71717a;">${SUPPORT_EMAIL}</a> adresine e-posta gönderin.</span>`;
}

export function oneWayFooterText(): string {
  return `Bu e-posta tek yönlü bir bilgilendirmedir — bu e-postaya yanıt vermek bize ulaşmaz. Geri bildirim için: ${SUPPORT_EMAIL}`;
}
