// Davet e-postası şablonu (plan.md Sprint 48j). Tek kullanımlık, süreli
// davet linki içerir. Diğer şablonlarla aynı inline-stil görsel dil.
import { escapeHtml, oneWayFooterHtml, oneWayFooterText } from "./html";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";

export interface InviteEmailInput {
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderInviteEmail(input: InviteEmailInput): RenderedEmail {
  const workspaceName = escapeHtml(input.workspaceName);
  const inviterName = escapeHtml(input.inviterName);
  const inviteUrl = escapeHtml(input.inviteUrl);
  const subject = `${workspaceName} çalışma alanına davet edildin`;

  const html = `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;"><span style="font-size:18px;font-weight:700;color:#18181b;">feedl</span></td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">${workspaceName} çalışma alanına davet edildin</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${inviterName} seni <strong>${workspaceName}</strong> çalışma alanına davet etti.</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">Daveti kabul ederek geri bildirimleri birlikte yönetmeye başlayabilirsin.</p>
            <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Daveti Kabul Et</a>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">Bu davet 7 gün geçerlidir. ${oneWayFooterHtml()}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${workspaceName} çalışma alanına davet edildin

${inviterName} seni ${input.workspaceName} çalışma alanına davet etti.

Daveti kabul et: ${input.inviteUrl}

Bu davet 7 gün geçerlidir. ${oneWayFooterText()}`;

  return { subject, html, text };
}
