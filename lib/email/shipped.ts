// "Shipped" bildirim e-postası şablonu (plan.md Sprint 6).
// E-posta istemcileri CSS sınıflarını desteklemediği için inline stil kullanılır.
// Alıcı e-postası buraya yazılmaz; gönderici katmanı (lib/email/send.ts) zaten
// alıcı listesini ayrı tutar — şablon yalnızca içerik üretir.
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app/portal";

export interface ShippedEmailInput {
  title: string;
  // Sprint 23: admin'in durum değişim açıklaması — varsa e-postada gösterilir.
  note?: string;
  // Sprint 26: alıcıya özel abonelikten çıkma linki (her alıcı için ayrı
  // render edilir).
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderShippedEmail(input: ShippedEmailInput): RenderedEmail {
  const title = escapeHtml(input.title);
  const note = input.note?.trim() ? escapeHtml(input.note.trim()) : null;
  const subject = `🎉 İsteğin yayına alındı: ${input.title}`;

  const extraFooter = input.unsubscribeUrl
    ? `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Durum bildirimlerini kapat</a>.`
    : "";
  const childHtml = `
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">🎉 İsteğin yayına alındı!</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Takip ettiğin şu özellik kullanıma açıldı:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                ${
                  note
                    ? `<div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #ff5c35;background-color:#fafafa;font-size:14px;line-height:1.6;color:#3f3f46;">${note}</div>`
                    : ""
                }
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Geri bildirimin ürünü doğrudan şekillendiriyor. Destek için teşekkürler!
                </p>
                ${brandButtonHtml("Portalda görüntüle", PORTAL_URL)}
              `;

  const html = emailShell(childHtml, extraFooter);

  const text = `Isteğin yayına alındı!

Takip ettiğin şu özellik kullanıma açıldı:

${input.title}
${
  note
    ? `
Ekibin notu:

${note}
`
    : ""
}
Geri bildirimin ürünü doğrudan şekillendiriyor. Destek için teşekkürler!

Portalda görüntüle: ${PORTAL_URL}

Bu bildirimi isteği desteklediğin veya gönderdiğin için alıyorsun.${
  input.unsubscribeUrl ? `\nDurum bildirimlerini kapat: ${input.unsubscribeUrl}` : ""
}
${oneWayFooterText()}`;

  return { subject, html, text };
}
