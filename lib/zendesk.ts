import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 48p — Zendesk connector. Zendesk Trigger → Webhook (target) ile
// ticket.created → feedl feedback. Doğrulama: benzerlik, Zendesk webhook'u
// custom header ile bir token gönderir; burada o token doğrulanır
// (ZENDESK_WEBHOOK_SECRET). Kurumsal imaj: uygulama adı/kanal feedl'dir,
// kişisel isim kullanılmaz.

// Zendesk webhook isteği örnek gövdesi (trigger JSON): ticket objesi.
export interface ZendeskTicket {
  id?: string;
  subject?: string;
  description?: string;
  comment?: { body?: string };
}

// Webhook secret doğrulaması. Zendesk webhook'ta Authentication="API key"
// seçilirse X-Api-Key başlığı gönderilir; ayrıca Authorization: Bearer ve
// X-Feedl-Token (eski) desteklenir. Yeterince uzun sekret ile karşılaştır.
function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyZendeskToken(headerValue: string): boolean {
  const secret = process.env.ZENDESK_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  const value = headerValue.replace(/^Bearer\s+/i, "").trim();
  return safeEqual(value, secret);
}

// İstek başlıklarından kimlik doğrulama değerini çıkar (çoklu kaynak).
export function zendeskAuthFromHeaders(headers: Headers): string {
  return (
    headers.get("x-api-key") ??
    headers.get("x-feedl-token") ??
    headers.get("authorization") ??
    ""
  );
}

// Zendesk ticket gövdesinden çekilecek feedback metni (uzun, anlamlı).
export function zendeskTicketText(
  ticket: ZendeskTicket,
): { title: string; body: string } {
  const subject = ticket.subject?.trim() ?? "";
  const description = ticket.description?.trim() ?? ticket.comment?.body?.trim() ?? "";
  const body = [subject, description].filter(Boolean).join("\n").slice(0, 4000);
  const title = subject.slice(0, 140) || "Zendesk destek talebi";
  return { title, body };
}

export function isZendeskConfigured(): boolean {
  return Boolean(process.env.ZENDESK_WEBHOOK_SECRET);
}
