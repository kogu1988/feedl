// Changelog duyuru e-postası şablonu (plan.md Sprint 40). E-posta
// istemcileri CSS sınıflarını ve markdown'ı güvenilir desteklemediği
// için gövde düz metne indirgenir (lib/email/shipped.ts ile aynı desen);
// alıcı e-postası buraya yazılmaz, gönderici katmanı alıcı listesini
// ayrı tutar.
import { escapeHtml } from "./html";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://getfeedl.vercel.app";

export interface ChangelogEmailInput {
  title: string;
  // Admin'in yazdığı markdown gövde — mailde markdown render EDİLMEZ,
  // düz metne çevrilir (mail istemcileri güvenilir desteklemez).
  body: string;
  // Duyuru sayfası linki — abone başına değil, duyuru başına sabit.
  entryUrl: string;
  // Her abone için ayrı render edilen token'lı çıkış linki.
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Markdown gövdeyi mail için düz metne indirger: kod blokları atılır,
// görseller alt metne, linkler "metin (url)" biçimine döner; başlık
// işaretleri ve vurgular kaldırılır, listeler madde işaretine döner.
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "• ")
    .trim();
}

function bodyToHtml(markdown: string): string {
  const text = markdownToPlainText(markdown);
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

export function renderChangelogEmail(input: ChangelogEmailInput): RenderedEmail {
  const title = escapeHtml(input.title);
  const bodyHtml = bodyToHtml(input.body);
  const bodyText = markdownToPlainText(input.body);
  const subject = `🎉 Yeni duyuru: ${input.title}`;

  const html = `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
                <span style="font-size:18px;font-weight:700;color:#18181b;">feedl</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">🎉 Yeni duyuru</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                ${bodyHtml}
                <a href="${input.entryUrl}"
                   style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                  Portalda görüntüle
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
                  Bu e-postayı feedl.co duyurularına abone olduğun için alıyorsun.
                  <a href="${input.unsubscribeUrl}" style="color:#71717a;">Feedl aboneliğinden çık</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Yeni duyuru: ${input.title}

${bodyText}

Portalda görüntüle: ${input.entryUrl}

Bu e-postayı feedl.co duyurularına abone olduğun için alıyorsun.
Feedl aboneliğinden çık: ${input.unsubscribeUrl}`;

  return { subject, html, text };
}
