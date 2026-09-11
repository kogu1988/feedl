import "server-only";

import { Resend } from "resend";

// Sağlayıcı seçimi: RESEND_API_KEY varsa Resend ile gönderilir. Yoksa e-posta
// atlanır — bildirim hatası ana akışı bozmamalı.

// Resend'de mail.feedl.app subdomaini doğrulanana kadar test göndericisi;
// EMAIL_FROM ile override edilebilir (feedl <no-reply@mail.feedl.app>).
const DEFAULT_FROM = "feedl <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Sprint 63v (deliverability): opsiyonel ek başlıklar — özellikle
  // List-Unsubscribe (Gmail/Outlook spam filtresini düşürür; bağlantılarımız
  // zaten reklamsız). Resend `headers` alanına geçirilir.
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  provider: "resend" | "skipped";
  sent: number;
  failed: number;
  // Sprint 63v: mesaj sırasıyla hizalı Resend message id (deliverability
  // webhook'u `email_deliveries.provider_id` ile eşleştirir). Alınamadıysa null.
  ids: (string | null)[];
}

export async function sendEmails(messages: EmailMessage[]): Promise<EmailSendResult> {
  if (messages.length === 0) {
    return { provider: "skipped", sent: 0, failed: 0, ids: [] };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return sendWithResend(resendKey, messages);
  }

  console.warn("Email skipped: RESEND_API_KEY not configured.");
  return { provider: "skipped", sent: 0, failed: 0, ids: [] };
}

async function sendWithResend(
  apiKey: string,
  messages: EmailMessage[],
): Promise<EmailSendResult> {
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  const { data, error } = await resend.batch.create(
    messages.map((message) => ({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    })),
  );

  if (error) {
    throw new Error(`Resend batch failed: ${error.message}`);
  }

  // Resend batch.create `data` her mesaj için sıralı { id } döner (genelde);
  // id yoksa null — teslimat geri bildirimi correlation'ı en iyi çaba.
  const ids: (string | null)[] = Array.isArray(data)
    ? data.map((item) => (typeof (item as { id?: unknown })?.id === "string" ? (item as { id: string }).id : null))
    : [];

  return {
    provider: "resend",
    sent: ids.filter(Boolean).length,
    failed: 0,
    ids,
  };
}
