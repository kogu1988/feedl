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

// Webhook secret doğrulaması. Zendesk webhook'a custom header ekleriz
// (ör. `X-Feedl-Token: <ZENDESK_WEBHOOK_SECRET>`); burada karşılaştırılır.
// Ayrıca isteğe bağlı HMAC imza desteği (Zendesk-Signature) eklenebilir.
export function verifyZendeskToken(tokenHeader: string): boolean {
  const secret = process.env.ZENDESK_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
    const a = Buffer.from(tokenHeader);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
