// E-posta şablonları için ortak HTML yardımcıları. `emailShell` tek kaynak —
// tüm Resend transactional mailleri aynı marka kimliğini (turuncu logo,
// marka rengi CTA, font) kullanır; şablonlar yalnız içerik sağlar.

// Kullanıcının kurumsal/support e-posta adresi (Squarespace yönlendirmesiyle
// kişisel adrese iletilir).
export const SUPPORT_EMAIL = "hi@feedl.app";

// Marka sabitleri (DESIGN.md §5 — turuncu/mercani marka).
export const BRAND_COLOR = "#ff5c35";
const MUTED = "#71717a";
const BORDER = "#e4e4e7";
const BG = "#f4f4f5";

// Feedl logo — turuncu PNG (`<img>`). E-posta istemcileri SVG güvenlik odaklı
// olduğundan desteklemez; şeffaf PNG her istemcide görünür (harici URL proxy
// edilir). Logo `public/logo_brand_orange.png` (128×128, şeffaf).
export function brandLogoHtml(): string {
  const logoUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  return `<img src="${logoUrl}/logo_brand_orange.png" width="128" height="128" alt="feedl" style="display:block;width:44px;height:44px;object-fit:contain;" />`;
}

// Ortak e-posta kabuğu: başlık (marka logo), gövde (`childHtml`), footer
// (tek yönlü bildirim + destek + opsiyonel ekstra). Tüm Resend şablonları bunu kullanır.
export function emailShell(childHtml: string, extraFooterHtml = ""): string {
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid ${BORDER};">
          <tr><td style="padding:24px 32px;border-bottom:1px solid ${BORDER};">${brandLogoHtml()}</td></tr>
          <tr><td style="padding:32px;">${childHtml}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${extraFooterHtml}${extraFooterHtml ? "<br />" : ""}${oneWayFooterHtml()}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Marka rengi CTA butonu (turuncu).
export function brandButtonHtml(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${label}</a>`;
}

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
  return `<span style="white-space:nowrap;">Lütfen bu e-postayı yanıtlamayınız — bu e-postaya yanıt vermek bize ulaşmaz. Geri bildirim için <a href="https://feedl.app/portal" style="color:#71717a;">feedl&#39;e yazın</a> ya da <a href="mailto:${SUPPORT_EMAIL}" style="color:#71717a;">${SUPPORT_EMAIL}</a> adresine e-posta gönderin.</span>`;
}

export function oneWayFooterText(): string {
  return `Lütfen bu e-postayı yanıtlamayınız — bu e-postaya yanıt vermek bize ulaşmaz. Geri bildirim için: ${SUPPORT_EMAIL}`;
}
