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
