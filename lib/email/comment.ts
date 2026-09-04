// Yorum bildirimi e-postası (plan.md Sprint 24). shipped şablonuyla aynı
// inline-stil görsel dil; alıcı e-postası şablona yazılmaz.
import { escapeHtml, oneWayFooterHtml, oneWayFooterText } from "./html";

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
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">${headline}</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  ${author}, şu fikre yorum yaptı:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                <div style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #18181b;background-color:#fafafa;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-line;">${body}</div>
                <a href="${input.ideaUrl}"
                   style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                  Fikri görüntüle
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
                  Bu bildirimi fikrin sana ait olduğu veya yorum yaptığın için alıyorsun.
                  ${
                    input.unsubscribeUrl
                      ? `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Yorum bildirimlerini kapat</a>.`
                      : ""
                  }
                  <br />
                  ${oneWayFooterHtml()}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
