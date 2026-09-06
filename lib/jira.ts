import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 57 (madde 2) — Jira connector. Jira Automation/Webhook → Issue
// created/updated → feedl feedback. Doğrulama: `X-Jira-Signature` başlığı,
// JIRA_WEBHOOK_SECRET ile statik karşılaştırma (Zendesk deseni). Jira
// Automation "Send web request" HMAC hesaplayamaz; bu yüzden secret'ı
// doğrudan custom header olarak göndeririz — HMAC-SHA256 değil.
// Kurumsal imaj: uygulama adı feedl.

// Jira webhook payload (Automation web request veya custom schema):
// { issue: { id, key, fields: { summary, description, creator } },
//   issue_event_type_name, webhookEvent }
export interface JiraTicket {
  id?: string;
  key?: string;
  fields?: {
    summary?: string;
    description?: string;
    creator?: { emailAddress?: string; displayName?: string } | null;
  };
}

export function verifyJiraSignature(
  rawBody: string,
  signatureHeader: string,
  secretOverride?: string | null,
): boolean {
  const secret = secretOverride ?? process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) return false;
  const value = (signatureHeader || "").trim();
  // Otomatik webhook (rest/webhooks/1.0 + secret): Jira `X-Hub-Signature:
  // sha256=<hmac>` başlığı gönderir — HMAC-SHA256(secret, rawBody) doğrula.
  if (value.startsWith("sha256=")) {
    const given = value.slice("sha256=".length).toLowerCase();
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqual(given, expected);
  }
  // Statik token (manuel Automation yolu): secret ile birebir karşılaştır.
  return safeEqual(value, secret);
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function parseJiraPayload(
  payload: Record<string, unknown>,
): { eventType: string; ticket: JiraTicket | null } {
  const eventType =
    typeof payload.issue_event_type_name === "string"
      ? payload.issue_event_type_name
      : typeof payload.webhookEvent === "string"
        ? payload.webhookEvent
        : "";
  const ticket = (payload.issue as JiraTicket | undefined) ?? null;
  return { eventType, ticket };
}

// Ticket'tan feedback metni çıkarır (summary + description).
export function jiraTicketText(
  ticket: JiraTicket,
): { title: string; body: string } {
  const title = (ticket.fields?.summary ?? "").trim().slice(0, 140);
  const body = (ticket.fields?.description ?? "").trim().slice(0, 4000);
  return { title: title || "Jira konu", body: body || title };
}

export function jiraIdentity(ticket: JiraTicket): string {
  return ticket.id || ticket.key || "jira";
}

export function isJiraConfigured(): boolean {
  return Boolean(process.env.JIRA_WEBHOOK_SECRET);
}

// --- Sprint 58: Otomatik webhook kaydı (API token ile) ---
// Jira, `rest/webhooks/1.0` ile kaydedilen webhook'lara imza göndermez; bu
// yüzden doğrulama için webhook URL'sine JIRA_WEBHOOK_SECRET'i token olarak
// ekliyoruz (?token=). Müşteri elle Automation kuralı kurmaz — biz kaydederiz.

const JIRA_WEBHOOK_EVENTS = ["jira:issue_created", "jira:issue_updated"];

export function jiraAuthReady(): boolean {
  return Boolean(
    process.env.JIRA_BASE_URL &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN,
  );
}

export function jiraCreds(): {
  baseUrl: string;
  email: string;
  token: string;
} {
  return {
    baseUrl: process.env.JIRA_BASE_URL ?? "",
    email: process.env.JIRA_EMAIL ?? "",
    token: process.env.JIRA_API_TOKEN ?? "",
  };
}

// Webhook kayıt URL'si. Production'da her zaman https://feedl.app. Token
// query'de DEĞİL; Jira `secret` ile imzaladığı için gövde HMAC'i doğrulanır.
export function jiraWebhookUrl(slug?: string, urlToken?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  const query = slug && urlToken ? `?ws=${encodeURIComponent(slug)}&t=${encodeURIComponent(urlToken)}` : "";
  return `${base}/api/integrations/jira/webhook${query}`;
}

function jiraBasicAuth(creds?: { baseUrl: string; email: string; token: string }): string {
  const { email, token } = creds ?? jiraCreds();
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

interface JiraWebhookRecord {
  id: number;
  url: string | null;
  webhookEvents: string[];
}

// Sitedeki mevcut webhook'ları listeler (idempotency için).
export async function listJiraWebhooks(
  creds?: { baseUrl: string; email: string; token: string },
): Promise<JiraWebhookRecord[]> {
  const { baseUrl } = creds ?? jiraCreds();
  const res = await fetch(`${baseUrl}/rest/webhooks/1.0/webhook`, {
    headers: { Authorization: jiraBasicAuth(creds) },
  });
  if (!res.ok) {
    throw new Error(`Jira webhook listesi alınamadı: ${res.status}`);
  }
  return (await res.json()) as JiraWebhookRecord[];
}

// Webhook'u kaydeder. Idempotency: zaten bizim URL'ye işaret eden bir webhook
// varsa yeniden oluşturmaz. Sadece issue_created/issue_updated abone olur.
export async function registerJiraWebhook(
  token: string,
  creds?: { baseUrl: string; email: string; token: string },
  webhookUrl?: string,
): Promise<{ registered: boolean; webhookId?: number }> {
  const { baseUrl } = creds ?? jiraCreds();
  const existing = await listJiraWebhooks(creds);
  const found = existing.find((w) =>
    (w.url ?? "").includes("/api/integrations/jira/webhook"),
  );
  if (found) {
    return { registered: false, webhookId: found.id };
  }

  const res = await fetch(`${baseUrl}/rest/webhooks/1.0/webhook`, {
    method: "POST",
    headers: {
      Authorization: jiraBasicAuth(creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "feedl",
      url: webhookUrl ?? jiraWebhookUrl(),
      events: JIRA_WEBHOOK_EVENTS,
      filters: { "issue-related-events-section": "" },
      excludeBody: false,
      secret: token,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira webhook kaydı başarısız: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: number };
  return { registered: true, webhookId: data.id };
}
