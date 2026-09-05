import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 48o — Slack connector. Slack Events API ile gelen mesajları
// feedl feedback'ine çevirir (AI triage yeniden kullanılır). Slack app
// credentials: SLACK_SIGNING_SECRET (event doğrulama) + SLACK_BOT_TOKEN
// (opsiyonel; ileride yanıt/aksiyon için). Kullanıcı Slack app oluşturup
// bu env'leri doldurunca aktif olur.

// Slack Events API imza doğrulaması: `X-Slack-Signature: v0=<hmac>` ve
// `X-Slack-Request-Timestamp`. HMAC-SHA256 `${timestamp}:${body}` üzerinden
// signing secret ile. Timing-safe karşılaştırma.
export function verifySlackSignature(
  body: string,
  signatureHeader: string,
  timestampHeader: string,
  secretOverride?: string | null,
): boolean {
  const secret = secretOverride ?? process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  // Replay önleme: timestamp 5 dakikadan eskiyse reddet (Slack önerisi).
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const sig = signatureHeader || "";
  const expected = createHmac("sha256", secret)
    .update(`v0:${timestampHeader}:${body}`)
    .digest("hex");
  const provided = sig.replace(/^v0=/, "");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Slack event body → çıkarılacak kullanıcı mesajı. `message` event'inin
// text alanı + kullanıcı.
export interface SlackIncomingMessage {
  text: string;
  userId: string | null;
  channel: string | null;
  eventTs: string | null;
}

export function parseSlackMessage(payload: Record<string, unknown>): SlackIncomingMessage | null {
  const event = (payload.event as Record<string, unknown>) ?? {};
  const type = event.type;
  if (type !== "message") return null;
  const subtype = event.subtype;
  // Bot mesajları, edit/delete gibi subtype'lar feedback olarak alınmaz.
  if (subtype && typeof subtype === "string" && ["bot_message", "message_changed", "message_deleted"].includes(subtype)) {
    return null;
  }
  const text = typeof event.text === "string" ? event.text.trim() : "";
  if (!text) return null;
  return {
    text,
    userId: typeof event.user === "string" ? event.user : null,
    channel: typeof event.channel === "string" ? event.channel : null,
    eventTs: typeof event.ts === "string" ? event.ts : null,
  };
}

// Slack app credentials yapılandırılmış mı?
export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_SIGNING_SECRET);
}
