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
  const nestedParts =
    typeof parts === "object" && parts !== null
      ? (parts as Record<string, unknown>)["ticket_parts" as keyof typeof parts]
      : parts;
  return (
    (Array.isArray(nestedParts) && nestedParts.length > 0) ||
    typeof ticketId === "string"
  );
}

// `ticket_attributes` içinden ilk dolu title-alamı döner (Intercom custom
// alan adı `_default_title_`, basit kurulumlarda `title`/`subject` vb.).
function ticketTitle(item: IntercomItem, topic: string | null): string {
  const attrs = field(item, "ticket_attributes", "ticketAttributes");
  if (typeof attrs === "object" && attrs !== null) {
    const a = attrs as Record<string, unknown>;
    // Önce bilinen alan adları.
    for (const key of ["_default_title_", "title", "subject"]) {
      if (typeof a[key] === "string" && (a[key] as string).trim()) {
        return (a[key] as string).trim();
      }
    }
    // Sonra herhangi bir `*_title_`/`*title*` benzeri alanı dene.
    for (const [k, v] of Object.entries(a)) {
      if (typeof v === "string" && v.trim() && /title/i.test(k)) {
        return v.trim();
      }
    }
  }
  const direct = fieldStr(item, "subject", "subject");
  if (direct.trim()) return direct.trim();
  return "Intercom destek talebi";
}

// `ticket_parts` hem düz dizi hem `{type, ticket_parts:[...]}` şeklinde gelir.
function ticketPartBodies(item: IntercomItem): string[] {
  const raw = field(item, "ticket_parts", "ticketParts");
  let list: Array<{ body?: unknown; part_type?: unknown }> = [];
  if (Array.isArray(raw)) {
    list = raw as Array<{ body?: unknown; part_type?: unknown }>;
  } else if (typeof raw === "object" && raw !== null) {
    const nested = (raw as Record<string, unknown>)["ticket_parts"];
    if (Array.isArray(nested)) list = nested as Array<{ body?: unknown; part_type?: unknown }>;
  }
  return list
    .map((p) => (typeof p.body === "string" ? p.body : ""))
    .filter((b) => b.trim());
}

// Item'dan çekilecek feedback metni (ilk mesaj gövdesi). Hem snake_case hem
// camelCase alan adlarını tanır; topic'e göre conversation veya ticket kısmı
// önceliklenir (ticket şart: bilet parçaları + custom alanlar önce).
export function intercomItemText(
  item: IntercomItem,
  topic: string | null,
): { title: string; body: string } {
  if (isTicketItem(item, topic)) {
    const partBodies = ticketPartBodies(item);
    // ticket_attributes altındaki _default_title_ / _default_description_
    // custom alanları: Intercom ticket formunun başlığı/aciklaması.
    const attrs = field(item, "ticket_attributes", "ticketAttributes") as
      | Record<string, unknown>
      | undefined;
    let attrTitle = "";
    let attrDescription = "";
    if (attrs && typeof attrs === "object") {
      if (typeof attrs._default_title_ === "string") attrTitle = (attrs._default_title_ as string).trim();
      if (typeof attrs._default_description_ === "string") attrDescription = (attrs._default_description_ as string).trim();
      if (!attrTitle && typeof attrs.subject === "string") attrTitle = (attrs.subject as string).trim();
    }
    const bodyText = (partBodies.join("\n") || attrDescription || attrTitle).trim();
    const body = bodyText.slice(0, 4000);
    const title = (ticketTitle(item, topic) || attrTitle).slice(0, 140);
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

// Kaynak kimliği: ticket için `ticket_id` (kullanıcının gördüğü numara);
// conversation için `id`/`conversation_id`.
export function intercomSourceRef(item: IntercomItem, topic: string | null): string | null {
  // Ticket: `ticket_id` (130693865) öncelikli — `id` Intercom iç kimliğidir.
  if (topic?.startsWith("ticket") || field(item, "ticket_id", "ticketId")) {
    const ticketId = fieldStr(item, "ticket_id", "ticketId");
    if (ticketId) return `intercom:${ticketId}`;
  }
  const id =
    fieldStr(item, "id", "id") || fieldStr(item, "conversation_id", "conversationId");
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

// Müşteri contact bilgisi: webhook'tan `contacts[].id` gelir ama e-posta/
// telefon yoktur. `INTERCOM_ACCESS_TOKEN` ile Intercom API'den gerçek bilgi
// çekilir (enrichment). PII: ağ isteği başarısız olursa graceful şekilde null
// döner (webhook'u durdurmaz).
export interface IntercomContactInfo {
  email: string | null;
  name: string | null;
  phone: string | null;
}

export function isIntercomTokenConfigured(): boolean {
  return Boolean(process.env.INTERCOM_ACCESS_TOKEN);
}

export async function fetchIntercomContact(
  contactId: string,
): Promise<IntercomContactInfo> {
  const token = process.env.INTERCOM_ACCESS_TOKEN;
  if (!token || !contactId) return { email: null, name: null, phone: null };
  try {
    const res = await fetch(`https://api.intercom.io/contacts/${contactId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Intercom-Version": "2.16",
      },
      // Webhook akışını bloklamasın: kısa zaman aşımı.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { email: null, name: null, phone: null };
    const data = (await res.json()) as Record<string, unknown>;
    return {
      email: typeof data.email === "string" ? data.email : null,
      name: typeof data.name === "string" ? data.name : null,
      phone: typeof data.phone === "string" && data.phone ? data.phone : null,
    };
  } catch (err) {
    console.error("intercom contact fetch failed:", err instanceof Error ? err.message : err);
    return { email: null, name: null, phone: null };
  }
}

// Item'dan ilk contact id'sini çıkarır (webhook'ta contacts[].id).
export function intercomContactId(item: IntercomItem): string | null {
  const contacts = field(item, "contacts", "contacts");
  if (Array.isArray(contacts)) {
    for (const c of contacts as Array<Record<string, unknown>>) {
      if (typeof c.id === "string" && c.id) return c.id;
    }
  } else if (typeof contacts === "object" && contacts !== null) {
    const nested = (contacts as Record<string, unknown>)["contacts"];
    if (Array.isArray(nested)) {
      for (const c of nested as Array<Record<string, unknown>>) {
        if (typeof c.id === "string" && c.id) return c.id;
      }
    }
  }
  return null;
}
