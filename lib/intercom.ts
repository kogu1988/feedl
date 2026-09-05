import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 48r — Intercom connector. Intercom Webhooks (Developer Hub →
// subscriptions) ile `conversation.user.created` (kullanıcı/lead'den yeni
// mesaj) → feedl feedback. Doğrulama: webhook gövdesindeki `app_id` alanı
// bizim Intercom app'imizin kimliğiyle (INTERCOM_APP_ID) eşleşmelidir —
// Intercom webhook'ları imza başlığı göndermez, bu yüzden app_id doğrulaması
// esas yöntemdir; opsiyonel INTERCOM_WEBHOOK_SECRET ile de
// `X-Intercom-Signature` HMAC-SHA256 doğrulanabilir (ileride açılırsa).
// Kurumsal imaj: uygulama adı/kanal feedl'dir, kişisel isim kullanılmaz.

// Intercom `conversation.user.created` webhook notifikasyonu `data.item`
// alanında bir "conversation" nesnesi taşır. İçinde ilk mesaj + contact.
export interface IntercomConversation {
  id?: string;
  conversationMessage?: {
    body?: string;
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
  item: IntercomConversation | null;
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

// Payload'dan feedback için ilgili conversation yapısını çıkarır.
export function parseIntercomPayload(
  payload: Record<string, unknown>,
): IntercomWebhookContext {
  const data = (payload.data as Record<string, unknown>) ?? {};
  const item = (data.item ?? payload.item ?? {}) as IntercomConversation;
  return {
    appId: typeof payload.app_id === "string" ? payload.app_id : null,
    topic: typeof payload.topic === "string" ? payload.topic : null,
    item,
  };
}

// Conversation'dan çekilecek feedback metni (ilk mesaj gövdesi).
export function intercomConversationText(
  item: IntercomConversation,
): { title: string; body: string } {
  const bodyText = item.conversationMessage?.body?.trim() ?? "";
  const body = bodyText.slice(0, 4000);
  const title =
    bodyText.split("\n").find((line) => line.trim())?.slice(0, 140) ??
    "Intercom mesajı";
  return { title, body };
}

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.INTERCOM_APP_ID);
}
