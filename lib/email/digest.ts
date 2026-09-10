// Faz 4 — haftalık AI özeti (digest) e-posta şablonu. İçerik, mevcut
// "AI İçgörüleri" görünümüyle AYNI şekli kullanır (themes/trends/quickWins/
// risks/recommendation) — tek kaynak korpus analizidir, burada yalnız sunum
// değişir. Alıcı listesi gönderici katmanında tutulur (lib/email/send.ts).
import { brandButtonHtml, emailShell, escapeHtml, oneWayFooterText } from "./html";
import type { CorpusInsights } from "@/lib/validations/ai";

// Korpus analizinin şekli tek kaynaktan alınır (zod şeması) — burada kopya
// bir arayüz tutulmaz, şema değişirse digest de otomatik uyar.
export type DigestInsights = CorpusInsights;

export interface DigestEmailInput {
  workspaceName: string;
  insights: DigestInsights;
  inboxUrl: string;
  newPostCount: number;
  totalPostCount: number;
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Digest'in iki gönderim arasındaki asgari aralığı. Haftalık cron bunu zaten
// sağlar; bu eşik manuel/tekrarlı tetiklemelerde çift gönderimi engeller.
export const DIGEST_MIN_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

// Haftalık özet gönderilmeli mi? Saf karar (test edilir).
// - Yalnız Pro workspace'ler (AI içgörüleri Pro özelliği).
// - Kullanıcı digest'i kapatmadıysa.
// - Yeni geri bildirim yoksa GÖNDERİLMEZ (boş özet gürültüdür).
// - Son gönderimden bu yana yeterli süre geçtiyse.
export function shouldSendDigest(input: {
  plan: string;
  enabled: boolean;
  lastSentAt: Date | null;
  newPostCount: number;
  now: Date;
}): boolean {
  if (!input.enabled) return false;
  if (input.plan !== "pro") return false;
  if (input.newPostCount <= 0) return false;
  if (
    input.lastSentAt &&
    input.now.getTime() - input.lastSentAt.getTime() < DIGEST_MIN_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}

function sectionHeading(label: string): string {
  return `<h2 style="margin:0 0 12px;font-size:15px;line-height:1.4;color:#18181b;">${label}</h2>`;
}

function renderThemes(themes: DigestInsights["themes"]): string {
  if (themes.length === 0) return "";
  const items = themes
    .map(
      (theme) => `
                  <li style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3f3f46;">
                    <strong style="color:#18181b;">${escapeHtml(theme.name)}</strong>
                    <span style="color:#71717a;"> · ${theme.count} istek</span><br />
                    ${escapeHtml(theme.summary)}
                  </li>`,
    )
    .join("");
  return `
                <div style="margin:0 0 24px;">
                  ${sectionHeading("Temalar")}
                  <ul style="margin:0;padding-left:20px;">${items}</ul>
                </div>`;
}

function renderQuickWins(quickWins: string[]): string {
  if (quickWins.length === 0) return "";
  const items = quickWins
    .map(
      (win) => `
                  <li style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(win)}</li>`,
    )
    .join("");
  return `
                <div style="margin:0 0 24px;">
                  ${sectionHeading("Hızlı kazanımlar")}
                  <ul style="margin:0;padding-left:20px;">${items}</ul>
                </div>`;
}

function renderRisks(risks: DigestInsights["risks"]): string {
  if (risks.length === 0) return "";
  const items = risks
    .map(
      (risk) => `
                  <li style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3f3f46;">
                    <strong style="color:#18181b;">${escapeHtml(risk.label)}</strong> — ${escapeHtml(risk.detail)}
                  </li>`,
    )
    .join("");
  return `
                <div style="margin:0 0 24px;">
                  ${sectionHeading("Riskler")}
                  <ul style="margin:0;padding-left:20px;">${items}</ul>
                </div>`;
}

function renderTrends(trends: DigestInsights["trends"]): string {
  if (trends.length === 0) return "";
  const items = trends
    .map(
      (trend) => `
                  <li style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;">
                    <strong style="color:#18181b;">${escapeHtml(trend.name)}</strong> — ${escapeHtml(trend.note)}
                  </li>`,
    )
    .join("");
  return `
                <div style="margin:0 0 24px;">
                  ${sectionHeading("Trendler")}
                  <ul style="margin:0;padding-left:20px;">${items}</ul>
                </div>`;
}

export function renderDigestEmail(input: DigestEmailInput): RenderedEmail {
  const { insights } = input;
  const workspaceName = escapeHtml(input.workspaceName);
  const subject = `📊 Haftalık özet: ${input.newPostCount} yeni geri bildirim`;

  const recommendation = insights.recommendation
    ? `
                <div style="margin:0 0 24px;padding:16px;background-color:#fff7ed;border-radius:8px;border:1px solid #fed7aa;">
                  <p style="margin:0 0 6px;font-size:13px;line-height:1.4;color:#9a3412;font-weight:600;">Bu haftanın önerisi</p>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#18181b;">${escapeHtml(insights.recommendation)}</p>
                </div>`
    : "";

  const childHtml = `
                <h1 style="margin:0 0 8px;font-size:20px;line-height:1.4;color:#18181b;">${workspaceName} haftalık özeti</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
                  Bu hafta <strong style="color:#18181b;">${input.newPostCount}</strong> yeni geri bildirim geldi
                  (toplam ${input.totalPostCount}). AI'ın korpusa bakarak çıkardığı özet:
                </p>
                ${recommendation}
                ${renderThemes(insights.themes)}
                ${renderQuickWins(insights.quickWins)}
                ${renderRisks(insights.risks)}
                ${renderTrends(insights.trends)}
                ${brandButtonHtml("İçgörüleri aç", input.inboxUrl)}
              `;

  const extraFooter = input.unsubscribeUrl
    ? `<a href="${input.unsubscribeUrl}" style="color:#71717a;">Haftalık özeti kapat</a>.<br />Bu özeti admin rolü nedeniyle alıyorsun.`
    : `Bu özeti admin rolü nedeniyle alıyorsun.`;

  const html = emailShell(childHtml, extraFooter);

  // Düz metin sürümü — aynı bilgi, sırayla.
  const textLines: string[] = [
    `${input.workspaceName} haftalık özeti`,
    "",
    `Bu hafta ${input.newPostCount} yeni geri bildirim geldi (toplam ${input.totalPostCount}).`,
  ];
  if (insights.recommendation) {
    textLines.push("", "Bu haftanın önerisi:", insights.recommendation);
  }
  if (insights.themes.length > 0) {
    textLines.push("", "Temalar:");
    for (const theme of insights.themes) {
      textLines.push(`- ${theme.name} (${theme.count} istek): ${theme.summary}`);
    }
  }
  if (insights.quickWins.length > 0) {
    textLines.push("", "Hızlı kazanımlar:");
    for (const win of insights.quickWins) textLines.push(`- ${win}`);
  }
  if (insights.risks.length > 0) {
    textLines.push("", "Riskler:");
    for (const risk of insights.risks) textLines.push(`- ${risk.label} — ${risk.detail}`);
  }
  if (insights.trends.length > 0) {
    textLines.push("", "Trendler:");
    for (const trend of insights.trends) textLines.push(`- ${trend.name} — ${trend.note}`);
  }
  textLines.push("", `İçgörüleri aç: ${input.inboxUrl}`);
  if (input.unsubscribeUrl) {
    textLines.push(`Haftalık özeti kapat: ${input.unsubscribeUrl}`);
  }
  textLines.push("", oneWayFooterText());

  return { subject, html, text: textLines.join("\n") };
}
