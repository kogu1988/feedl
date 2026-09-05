import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 48r — Intercom connector. Intercom Webhooks (Developer Hub →
// subscriptions) ile hem `conversation.user.created` (kullanıcı/lead yeni
// mesajı) hem `ticket.created`/`ticket.updated` (Intercom Tickets) → feedl
// feedback. Doğrulama: webhook gövdesindeki `app_id` alanı bizim Intercom
// app'imizin kimliğiyle (INTERCOM_APP_ID) eşleşmelidir — Intercom webhook'ları
// imza başlığı göndermez, bu yüzden app_id doğrulaması esas yöntemdir;
// opsiyonel INTERCOM_WEBHOOK_SECRET ile de `X-Intercom-Signature` HMAC-SHA256
// doğrulanabilir (ileride açılırsa). Kurumsal imaj: uygulama adı/kanal
// feedl'dir, kişisel isim kullanılmaz.

// Farklı Intercom sürümleri mesajı birkaç alana koyabilir: conversation için
// `conversation_message`/`last_message`/`first_message`/`parts`; ticket için
// `ticket_parts` (parça mesajları) + `ticket_attributes` (subject/ilk açıklama).
// Hepsini toplayıp ilk dolu olanı seçiyoruz.
export interface IntercomItem {
  id?: string;
  // Conversation alanları.
  conversationMessage?: { body?: string };
  lastMessage?: { body?: string };
  firstMessage?: { body?: string };
  message?: { body?: string };
  parts?: Array<{ body?: string }>;
  // Ticket alanları.
  ticketId?: string;
  ticketParts?: Array<{ body?: string; type?: string }>;
  ticketAttributes?: {
    title?: string;
    subject?: string;
    description?: string;
    [key: string]: unknown;
  };
  contact?: {
    id?: string;
    email?: string | null;
    name?: string | null;
  };
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

// Opsiyonel `X-Intercom-Signature: sha256=<hex>` doğrulaması (Intercom
// webhook "webhook secret" etkinse). HMAC-SHA256 doğrudan ham gövde üzerinden.
function verifyIntercomSignature(rawBody: string, headerValue: string): boolean {
  const secret = process.env.INTERCOM_WEBHOOK_SECRET;
  if (!secret) return false;
  const value = headerValue.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(value, expected);
}

export interface IntercomWebhookContext {
  appId: string | null;
  topic: string | null;
  item: IntercomItem | null;
}

// Webhook gövdesini çıkarır; `app_id` doğrulaması + opsiyonel imza.
export function verifyIntercomWebhook(
  payload: Record<string, unknown>,
  rawBody: string,
  headers: Headers,
): boolean {
  const appId = process.env.INTERCOM_APP_ID;
  if (!appId) return false;
  const payloadAppId = typeof payload.app_id === "string" ? payload.app_id : "";
  if (payloadAppId && payloadAppId === appId) return true;
  // Alternatif: imza başlığı ile doğrula (INTERCOM_WEBHOOK_SECRET setse).
  const signature = headers.get("x-intercom-signature");
  if (signature && verifyIntercomSignature(rawBody, signature)) return true;
  return false;
}

// Payload'dan feedback için ilgili conversation/ticket yapısını çıkarır.
export function parseIntercomPayload(
  payload: Record<string, unknown>,
): IntercomWebhookContext {
  const data = (payload.data as Record<string, unknown>) ?? {};
  const item = (data.item ?? payload.item ?? {}) as IntercomItem;
  return {
    appId: typeof payload.app_id === "string" ? payload.app_id : null,
    topic: typeof payload.topic === "string" ? payload.topic : null,
    item,
  };
}

// Ticket'ta custom alanlar `ticket_attributes` içinde gelir; subject/title
// kolay okunmazsa oradan da denenir.
function ticketTitle(item: IntercomItem): string {
  const attrs = item.ticketAttributes ?? {};
  if (typeof attrs.title === "string" && attrs.title.trim()) return attrs.title;
  if (typeof attrs.subject === "string" && attrs.subject.trim()) return attrs.subject;
  return "Intercom destek talebi";
}

// Item'dan çekilecek feedback metni (ilk mesaj gövdesi). Birden fazla olası
// alandan toplarız; topic'e göre conversation veya ticket kısmı önceliklenir.
export function intercomItemText(
  item: IntercomItem,
  topic: string | null,
): { title: string; body: string } {
  // Ticket: parça mesajları (ticket_parts) + custom alanlar (subject/description).
  const isTicket = topic?.startsWith("ticket") || (item.ticketParts !== undefined && item.ticketParts !== null && item.ticketParts.length > 0) || Boolean(item.ticketId);
  if (isTicket) {
    const partBodies = (item.ticketParts ?? [])
      .map((p) => p.body)
      .filter((b): b is string => Boolean(b && b.trim()));
    const attrs = item.ticketAttributes ?? {};
    const attrDescription =
      typeof attrs.description === "string" && attrs.description.trim()
        ? attrs.description
        : "";
    const bodyText = (partBodies.join("\n") || attrDescription).trim();
    const body = bodyText.slice(0, 4000);
    const title = ticketTitle(item).slice(0, 140);
    return { title: title || "Intercom destek talebi", body };
  }

  // Conversation: birincil ilk mesaj + diğer olası alanlar.
  const candidates: Array<string | undefined> = [
    item.conversationMessage?.body,
    item.lastMessage?.body,
    item.firstMessage?.body,
    item.message?.body,
    ...(item.parts ?? []).map((part) => part.body),
  ];
  const bodyText = candidates.find((b) => b && b.trim())?.trim() ?? "";
  const body = bodyText.slice(0, 4000);
  const title =
    bodyText.split("\n").find((line) => line.trim())?.slice(0, 140) ??
    "Intercom mesajı";
  return { title, body };
}

// Kaynak kimliği: conversation.id veya ticket.id/ticket_id.
export function intercomSourceRef(item: IntercomItem, topic: string | null): string | null {
  const id = item.id ?? item.ticketId;
  if (!id) return null;
  return `intercom:${id}`;
}

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.INTERCOM_APP_ID);
}
