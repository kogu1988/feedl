// Status güncelleme bildirimi e-postası (plan.md Sprint 26) — shipped
// harici durum geçişlerinde takipçilere gider. shipped şablonuyla aynı
// inline-stil görsel dil; alıcı e-postası şablona yazılmaz.
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";

export interface StatusUpdateEmailInput {
  ideaTitle: string;
  ideaUrl: string;
  oldStatusLabel: string;
  newStatusLabel: string;
  note?: string;
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderStatusUpdateEmail(
  input: StatusUpdateEmailInput,
): RenderedEmail {
  const title = escapeHtml(input.ideaTitle);
  const oldLabel = escapeHtml(input.oldStatusLabel);
  const newLabel = escapeHtml(input.newStatusLabel);
  const note = input.note?.trim() ? escapeHtml(input.note.trim()) : null;

  const subject = `Fikrin güncellendi: ${input.ideaTitle}`;

  const extraFooter = input.unsubscribeUrl
    ? `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Durum bildirimlerini kapat</a>.`
    : "";
  const childHtml = `
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">📌 Takip ettiğin fikir güncellendi</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Şu fikrin durumu <strong style="color:#18181b;">${oldLabel}</strong> → <strong style="color:#18181b;">${newLabel}</strong> olarak güncellendi:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                ${
                  note
                    ? `<div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #ff5c35;background-color:#fafafa;font-size:14px;line-height:1.6;color:#3f3f46;">${note}</div>`
                    : ""
                }
                ${brandButtonHtml("Fikri görüntüle", input.ideaUrl)}
              `;
  const html = emailShell(childHtml, extraFooter);

  const text = `Takip ettiğin fikir güncellendi

${input.ideaTitle}

Durum: ${input.oldStatusLabel} → ${input.newStatusLabel}${
    note ? `\n\nEkibin notu:\n\n${note}` : ""
  }

Fikri görüntüle: ${input.ideaUrl}

Bu bildirimi fikri takip ettiğin için alıyorsun.${
    input.unsubscribeUrl ? `\nDurum bildirimlerini kapat: ${input.unsubscribeUrl}` : ""
  }
${oneWayFooterText()}`;

  return { subject, html, text };
}
