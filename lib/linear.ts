import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Sprint 56 (madde 2) — Linear connector. Linear Webhooks (workspace
// ayarlarına webhook URL eklenir) → Issue.create/update → feedl feedback.
// Doğrulama: `X-Linear-Signature` başlığı — webhook signing secret ile ham
// gövdenin HMAC-SHA256'sı (hex). Kurumsal imaj: uygulama adı feedl.

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

// Linear webhook payload: { action, data: { id, title, description, ... }, type }
export interface LinearIssue {
  id?: string;
  identifier?: string;
  title?: string;
  description?: string;
  url?: string;
  team?: { name?: string } | null;
}

export function parseLinearPayload(
  payload: Record<string, unknown>,
): { action: string; issue: LinearIssue | null } {
  const action =
    typeof payload.action === "string" ? payload.action : "";
  const issue = (payload.data as LinearIssue | undefined) ?? null;
  return { action, issue };
}

// Issue'dan feedback metni çıkarır (başlık + açıklama).
export function linearIssueText(
  issue: LinearIssue,
): { title: string; body: string } {
  const title = (issue.title ?? "").trim().slice(0, 140);
  const body = (issue.description ?? "").trim().slice(0, 4000);
  return { title: title || "Linear konu", body: body || title };
}

export function isLinearConfigured(): boolean {
  return Boolean(process.env.LINEAR_WEBHOOK_SECRET);
}
