import "server-only";

import { timingSafeEqual } from "node:crypto";

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
): boolean {
  void rawBody; // HMAC kullanılmıyor; statik secret karşılaştırması yapıyoruz.
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) return false;
  const value = (signatureHeader || "").trim();
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

// Webhook kayıt URL'si. Production'da her zaman https://feedl.app; token'ı
// query'de taşır (Jira imza göndermediği için).
export function jiraWebhookUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  return `${base}/api/integrations/jira/webhook?token=${encodeURIComponent(token)}`;
}

function jiraBasicAuth(): string {
  const { email, token } = jiraCreds();
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

interface JiraWebhookRecord {
  id: number;
  url: string | null;
  webhookEvents: string[];
}

// Sitedeki mevcut webhook'ları listeler (idempotency için).
export async function listJiraWebhooks(): Promise<JiraWebhookRecord[]> {
  const { baseUrl } = jiraCreds();
  const res = await fetch(`${baseUrl}/rest/webhooks/1.0/webhook`, {
    headers: { Authorization: jiraBasicAuth() },
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
): Promise<{ registered: boolean; webhookId?: number }> {
  const { baseUrl } = jiraCreds();
  const existing = await listJiraWebhooks();
  const found = existing.find((w) =>
    (w.url ?? "").includes("/api/integrations/jira/webhook"),
  );
  if (found) {
    return { registered: false, webhookId: found.id };
  }

  const res = await fetch(`${baseUrl}/rest/webhooks/1.0/webhook`, {
    method: "POST",
    headers: {
      Authorization: jiraBasicAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "feedl",
      url: jiraWebhookUrl(token),
      webhookEvents: JIRA_WEBHOOK_EVENTS,
      jqlFilter: "",
      excludeBody: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira webhook kaydı başarısız: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: number };
  return { registered: true, webhookId: data.id };
}
