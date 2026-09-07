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

// Feedl marka başlığı — turuncu logo (PNG) + SİYAH "feedl" adı, tıklanınca
// siteye gider. E-posta istemcileri SVG desteklemez; şeffaf PNG + metin.
const BRAND_DARK = "#18181b";
export function brandLogoHtml(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  return `<a href="${appUrl}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;"><img src="${appUrl}/logo_brand_orange.png" width="32" height="32" alt="feedl" style="display:block;width:32px;height:32px;object-fit:contain;" /><span style="font-size:20px;font-weight:800;color:${BRAND_DARK};letter-spacing:-0.02em;">feedl</span></a>`;
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

// HTML footer bloğu: tek yönlü bildirim + site linki + kurumsal destek adresi.
// Var olan her şablonun footer <td> içine eklenir.
export function oneWayFooterHtml(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  return `<span style="white-space:nowrap;">Lütfen bu e-postayı yanıtlamayınız — bu e-postaya yanıt vermek bize ulaşmaz. Soruların için <a href="${appUrl}" style="color:#71717a;">feedl.app</a> adresini ziyaret et ya da <a href="mailto:${SUPPORT_EMAIL}" style="color:#71717a;">${SUPPORT_EMAIL}</a> adresine yaz.</span>`;
}

export function oneWayFooterText(): string {
  return `Lütfen bu e-postayı yanıtlamayınız — bu e-postaya yanıt vermek bize ulaşmaz. Geri bildirim için: ${SUPPORT_EMAIL}`;
}
