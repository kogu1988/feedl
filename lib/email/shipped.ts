// "Shipped" bildirim e-postası şablonu (plan.md Sprint 6).
// E-posta istemcileri CSS sınıflarını desteklemediği için inline stil kullanılır.
// Alıcı e-postası buraya yazılmaz; gönderici katmanı (lib/email/send.ts) zaten
// alıcı listesini ayrı tutar — şablon yalnızca içerik üretir.

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getfeedl.vercel.app/portal";

export interface ShippedEmailInput {
  title: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderShippedEmail(input: ShippedEmailInput): RenderedEmail {
  const title = escapeHtml(input.title);
  const subject = `🎉 İsteğin yayına alındı: ${input.title}`;

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
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">🎉 İsteğin yayına alındı!</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Takip ettiğin şu özellik kullanıma açıldı:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Geri bildirimin ürünü doğrudan şekillendiriyor. Destek için teşekkürler!
                </p>
                <a href="${PORTAL_URL}"
                   style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                  Portalda görüntüle
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
                  Bu bildirimi isteği desteklediğin veya gönderdiğin için alıyorsun.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Isteğin yayına alındı!

Takip ettiğin şu özellik kullanıma açıldı:

${input.title}

Geri bildirimin ürünü doğrudan şekillendiriyor. Destek için teşekkürler!

Portalda görüntüle: ${PORTAL_URL}

Bu bildirimi isteği desteklediğin veya gönderdiğin için alıyorsun.`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
