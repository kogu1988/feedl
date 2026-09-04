// Admin "yeni fikir" bildirim e-postası şablonu (plan.md Sprint 18).
// E-posta istemcileri CSS sınıflarını desteklemediği için inline stil
// kullanılır (shipped.ts ile aynı görsel dil). Alıcı listesi gönderici
// katmanında (lib/email/send.ts) tutulur; şablon yalnızca içerik üretir.
import { escapeHtml } from "./html";

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app/portal";

export interface AdminNewPostEmailInput {
  title: string;
  description: string;
  authorName: string;
  postId: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const DESCRIPTION_MAX_LENGTH = 400;

function summarize(text: string): string {
  return text.length > DESCRIPTION_MAX_LENGTH
    ? `${text.slice(0, DESCRIPTION_MAX_LENGTH).trimEnd()}…`
    : text;
}

export function renderAdminNewPostEmail(
  input: AdminNewPostEmailInput,
): RenderedEmail {
  const title = escapeHtml(input.title);
  const authorName = escapeHtml(input.authorName);
  const description = escapeHtml(summarize(input.description)).replaceAll(
    "\n",
    "<br />",
  );
  const postUrl = `${PORTAL_URL}/${input.postId}`;
  const subject = `📬 Yeni fikir: ${input.title}`;

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
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">📬 Yeni fikir geldi!</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  <strong style="color:#18181b;">${authorName}</strong> yeni bir fikir gönderdi:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">${description}</p>
                <a href="${postUrl}"
                   style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                  Fikri incele
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
                  Bu bildirimi admin rolü nedeniyle alıyorsun.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Yeni fikir geldi!

${input.authorName} yeni bir fikir gönderdi:

${input.title}

${summarize(input.description)}

Fikri incele: ${postUrl}

Bu bildirimi admin rolü nedeniyle alıyorsun.`;

  return { subject, html, text };
}
