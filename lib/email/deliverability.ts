import "server-only";

// Sprint 63v (deliverability) — Resend webhook olay eşleme + hard-bounce
// tespiti. Saf fonksiyonlar (DB yok) — birim test edilir.

export type EmailDeliveryStatus = "sent" | "delivered" | "bounced" | "complained";

export const EMAIL_STATUS_BY_EVENT: Record<string, EmailDeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

// Olay türü → teslimat durumu. Bilinmeyen → null (yoksayılır).
export function deriveEmailStatus(eventType: string): EmailDeliveryStatus | null {
  return EMAIL_STATUS_BY_EVENT[eventType] ?? null;
}

// Hard bounce (kalıcı) / spam complaint işaretini kapatır mı?
// Resend bounce.type: 'bounced' (kalıcı) | 'transient' | 'complained'.
// 'transient' (geçici/yumuşak) kalıcı değildir → kapatma. Complaint her zaman hard.
export function marksSuppressed(eventType: string, bounceType: string | null): boolean {
  if (eventType === "email.complained") return true;
  if (eventType === "email.bounced") return bounceType === "bounced" || bounceType === null;
  return false;
}
