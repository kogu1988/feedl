// Admin "yeni fikir" bildirim e-postası şablonu (plan.md Sprint 18).
// E-posta istemcileri CSS sınıflarını desteklemediği için inline stil
// kullanılır (shipped.ts ile aynı görsel dil). Alıcı listesi gönderici
// katmanında (lib/email/send.ts) tutulur; şablon yalnızca içerik üretir.
import { brandButtonHtml, emailShell, escapeHtml } from "./html";

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

  const childHtml = `
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#18181b;">📬 Yeni fikir geldi!</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  <strong style="color:#18181b;">${authorName}</strong> yeni bir fikir gönderdi:
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${title}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3f3f46;">${description}</p>
                ${brandButtonHtml("Fikri incele", postUrl)}
              `;
  const html = emailShell(childHtml, `<span>Bu bildirimi admin rolü nedeniyle alıyorsun.</span>`);

  const text = `Yeni fikir geldi!

${input.authorName} yeni bir fikir gönderdi:

${input.title}

${summarize(input.description)}

Fikri incele: ${postUrl}

Bu bildirimi admin rolü nedeniyle alıyorsun.`;

  return { subject, html, text };
}
