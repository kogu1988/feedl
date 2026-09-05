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

// Intercom webhook alanları snake_case gelir (`conversation_message`,
// `last_message`, `ticket_parts`, `ticket_attributes`, `ticket_id`).
// Tipini kaybetmemek için item'ı esnek bir kayıt olarak ele alırız ve
// her alanı hem snake_case hem camelCase olarak okuruz.
export type IntercomItem = Record<string, unknown>;

function field(item: IntercomItem, snake: string, camel: string): unknown {
  return item[snake] ?? item[camel];
}

function fieldStr(item: IntercomItem, snake: string, camel: string): string {
  const v = field(item, snake, camel);
  return typeof v === "string" ? v : "";
}

function fieldBody(item: IntercomItem, snake: string, camel: string): string {
  const v = field(item, snake, camel);
  return typeof v === "object" && v !== null
    ? (v as { body?: unknown }).body?.toString() ?? ""
    : "";
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

// Soru işareti: bu bir ticket mı? (topic ticket.* veya ticket alanları var.)
function isTicketItem(item: IntercomItem, topic: string | null): boolean {
  if (topic?.startsWith("ticket")) return true;
  const parts = field(item, "ticket_parts", "ticketParts");
  const ticketId = field(item, "ticket_id", "ticketId");
  return (
    (Array.isArray(parts) && parts.length > 0) || typeof ticketId === "string"
  );
}

// Ticket'ta title/subject custom alanlar `ticket_attributes` içinde gelir.
function ticketTitle(item: IntercomItem, topic: string | null): string {
  const attrs = field(item, "ticket_attributes", "ticketAttributes");
  if (typeof attrs === "object" && attrs !== null) {
    const a = attrs as Record<string, unknown>;
    for (const key of ["title", "subject"]) {
      if (typeof a[key] === "string" && (a[key] as string).trim()) {
        return (a[key] as string).trim();
      }
    }
  }
  // Bazı kurulumlar subject'i doğrudan item'a da yazar.
  const direct = fieldStr(item, "subject", "subject");
  if (direct.trim()) return direct.trim();
  return "Intercom destek talebi";
}

// Item'dan çekilecek feedback metni (ilk mesaj gövdesi). Hem snake_case hem
// camelCase alan adlarını tanır; topic'e göre conversation veya ticket kısmı
// önceliklenir (ticket şart: bilet parçaları önce).
export function intercomItemText(
  item: IntercomItem,
  topic: string | null,
): { title: string; body: string } {
  if (isTicketItem(item, topic)) {
    const parts = field(item, "ticket_parts", "ticketParts");
    let partBodies: string[] = [];
    if (Array.isArray(parts)) {
      partBodies = (parts as Array<{ body?: unknown; type?: string }>)
        .map((p) => (typeof p.body === "string" ? p.body : ""))
        .filter((b) => b.trim());
    }
    // ticket_attributes altındaki description da ek kaynak.
    const attrs = field(item, "ticket_attributes", "ticketAttributes") as
      | Record<string, unknown>
      | undefined;
    let attrDescription = "";
    if (attrs && typeof attrs.description === "string") {
      attrDescription = attrs.description.trim();
    } else if (attrs && typeof attrs.subject === "string") {
      attrDescription = attrs.subject.trim();
    }
    const bodyText = (partBodies.join("\n") || attrDescription).trim();
    const body = bodyText.slice(0, 4000);
    const title = ticketTitle(item, topic).slice(0, 140);
    return { title: title || "Intercom destek talebi", body };
  }

  // Conversation: birincil ilk mesaj + diğer olası alanlar.
  const candidates: string[] = [
    fieldBody(item, "conversation_message", "conversationMessage"),
    fieldBody(item, "last_message", "lastMessage"),
    fieldBody(item, "first_message", "firstMessage"),
    fieldBody(item, "message", "message"),
  ];
  const parts = field(item, "parts", "parts");
  if (Array.isArray(parts)) {
    for (const part of parts as Array<{ body?: unknown }>) {
      if (typeof part.body === "string") candidates.push(part.body);
    }
  }
  const bodyText = candidates.find((b) => b && b.trim())?.trim() ?? "";
  const body = bodyText.slice(0, 4000);
  const title =
    bodyText.split("\n").find((line) => line.trim())?.slice(0, 140) ??
    "Intercom mesajı";
  return { title, body };
}

// Kaynak kimliği: conversation.id veya ticket.id/ticket_id.
export function intercomSourceRef(item: IntercomItem, topic: string | null): string | null {
  const id =
    fieldStr(item, "id", "id") ||
    fieldStr(item, "ticket_id", "ticketId") ||
    fieldStr(item, "conversation_id", "conversationId");
  if (!id) return null;
  return `intercom:${id}`;
}

// Kimlik için contact id (varsa) — conversation/ticket contact'ı.
export function intercomIdentity(item: IntercomItem): string {
  const contact = field(item, "contact", "contact");
  if (typeof contact === "object" && contact !== null) {
    const c = contact as Record<string, unknown>;
    if (typeof c.id === "string") return c.id;
  }
  return (
    intercomSourceRef(item, null)?.replace(/^intercom:/, "") ??
    "intercom"
  );
}

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.INTERCOM_APP_ID);
}
