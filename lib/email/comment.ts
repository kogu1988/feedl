// Yorum bildirimi e-postası (plan.md Sprint 24). shipped şablonuyla aynı
// inline-stil görsel dil; alıcı e-postası şablona yazılmaz.
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";

export interface CommentEmailInput {
  ideaTitle: string;
  // Fikir detay sayfasının tam adresi (çağıran taraf oluşturur).
  ideaUrl: string;
  commenterName: string | null;
  commentBody: string;
  // Yanıt bildiriminde "yanıt olarak" metni gösterilir.
  isReply: boolean;
  // Sprint 26: alıcıya özel abonelikten çıkma linki.
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderCommentEmail(input: CommentEmailInput): RenderedEmail {
  const title = escapeHtml(input.ideaTitle);
  const author = escapeHtml(input.commenterName ?? "Bir üye");
  const body = escapeHtml(input.commentBody);

  const headline = input.isReply
    ? "💬 Fikirdeki yorumuna yanıt geldi!"
    : "💬 Fikrine yeni yorum geldi!";
  const subject = input.isReply
    ? `Yorumuna yanıt geldi: ${input.ideaTitle}`
    : `Fikrine yeni yorum: ${input.ideaTitle}`;

  const extraFooter = input.unsubscribeUrl
    ? `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Yorum bildirimlerini kapat</a>.`
    : "";
  const childHtml = `
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">${headline}</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  ${author}, şu fikre yorum yaptı:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                <div style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #ff5c35;background-color:#fafafa;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-line;">${body}</div>
                ${brandButtonHtml("Fikri görüntüle", input.ideaUrl)}
              `;
  const html = emailShell(childHtml, extraFooter);

  const text = `${headline}

${input.commenterName ?? "Bir üye"}, şu fikre yorum yaptı:

${input.ideaTitle}

"${input.commentBody}"

Fikri görüntüle: ${input.ideaUrl}${
  input.unsubscribeUrl ? `\nYorum bildirimlerini kapat: ${input.unsubscribeUrl}` : ""
}
${oneWayFooterText()}`;

  return { subject, html, text };
}
