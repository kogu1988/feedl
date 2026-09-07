// Davet e-postası şablonu (plan.md Sprint 48j). Tek kullanımlık, süreli
// davet linki içerir. Diğer şablonlarla aynı inline-stil görsel dil.
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";

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

  const childHtml = `
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">${workspaceName} çalışma alanına davet edildin</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${inviterName} seni <strong>${workspaceName}</strong> çalışma alanına davet etti.</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">Daveti kabul ederek geri bildirimleri birlikte yönetmeye başlayabilirsin.</p>
            ${brandButtonHtml("Daveti Kabul Et", inviteUrl)}
          `;

  const html = emailShell(childHtml);

  const text = `${workspaceName} çalışma alanına davet edildin

${inviterName} seni ${input.workspaceName} çalışma alanına davet etti.

Daveti kabul et: ${input.inviteUrl}

Bu davet 7 gün geçerlidir. ${oneWayFooterText()}`;

  return { subject, html, text };
}
