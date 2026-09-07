// Changelog duyuru e-postası şablonu (plan.md Sprint 40). E-posta
// istemcileri CSS sınıflarını ve markdown'ı güvenilir desteklemediği
// için gövde düz metne indirgenir (lib/email/shipped.ts ile aynı desen);
// alıcı e-postası buraya yazılmaz, gönderici katmanı alıcı listesini
// ayrı tutar.
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";

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

  const childHtml = `
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">🎉 Yeni duyuru</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                ${bodyHtml}
                ${brandButtonHtml("Portalda görüntüle", input.entryUrl)}
              `;
  const extraFooter = `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Feedl aboneliğinden çık</a>.<br />Bu e-postayı feedl.app duyurularına abone olduğun için alıyorsun.`;
  const html = emailShell(childHtml, extraFooter);

  const text = `Yeni duyuru: ${input.title}

${bodyText}

Portalda görüntüle: ${input.entryUrl}

Bu e-postayı feedl.app duyurularına abone olduğun için alıyorsun.
Feedl aboneliğinden çık: ${input.unsubscribeUrl}
${oneWayFooterText()}`;

  return { subject, html, text };
}
