import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 56 (madde 2) — Linear connector. Linear Webhooks (workspace
// ayarlarına webhook URL eklenir) → Issue/Comment/CustomerRequest → feedl
// feedback. Doğrulama: `X-Linear-Signature` başlığı — webhook signing secret
// ile ham gövdenin HMAC-SHA256'sı (hex). Kurumsal imaj: uygulama adı feedl.

// Linear webhook imza doğrulaması.
export function verifyLinearSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) return false;
  const value = (signatureHeader || "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(value, expected);
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// Linear webhook payload: { action, type, data }. `type` — Issue | Comment |
// CustomerRequest (CustomerNeeds). `data` her tür için farklı şekildedir.
export interface LinearData {
  id?: string;
  identifier?: string;
  title?: string;
  description?: string;
  body?: string;
  url?: string;
  team?: { name?: string } | null;
  issue?: { title?: string } | null;
  source?: string;
}

export function parseLinearPayload(
  payload: Record<string, unknown>,
): { action: string; type: string; data: LinearData | null } {
  const action = typeof payload.action === "string" ? payload.action : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  const data = (payload.data as LinearData | undefined) ?? null;
  return { action, type, data };
}

// Event türüne göre feedback metni üretir.
// - Issue / CustomerRequest: title + description.
// - Comment: ait olduğu issue başlığı + yorum gövdesi.
export function linearDataText(
  type: string,
  data: LinearData,
): { title: string; body: string } {
  if (type === "Comment") {
    const parentTitle = (data.issue?.title ?? "").trim() || "Linear konu";
    const body = (data.body ?? "").trim().slice(0, 4000);
    return {
      title: `${parentTitle} — yorum`.slice(0, 140),
      body: body || parentTitle,
    };
  }

  // Issue | CustomerRequest | diğer
  const title = (data.title ?? "").trim().slice(0, 140);
  const body = (data.description ?? data.body ?? "").trim().slice(0, 4000);
  return { title: title || "Linear konu", body: body || title };
}

export function isLinearConfigured(): boolean {
  return Boolean(process.env.LINEAR_WEBHOOK_SECRET);
}
