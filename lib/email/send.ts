import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

// Sağlayıcı seçimi (plan.md Sprint 6): RESEND_API_KEY varsa production'da
// Resend kullanılır; yoksa Ethereal.email SMTP ile test edilir (gerçek teslimat
// yok, mesajlar Ethereal gelen kutusunda önizlenir). İkisi de yoksa e-posta
// atlanır — bildirim hatası ana akışı bozmamalı.

const ETHEREAL_SMTP_HOST = "smtp.ethereal.email";
const ETHEREAL_SMTP_PORT = 587;

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
  provider: "resend" | "ethereal" | "skipped";
  sent: number;
  failed: number;
  // Ethereal'de her mesajın web önizleme adresi (testte kanıt olarak kullanılır).
  previewUrls: string[];
  // Sprint 63v: mesaj sırasıyla hizalı Resend message id (deliverability
  // webhook'u `email_deliveries.provider_id` ile eşleştirir). Alınamadıysa null.
  ids: (string | null)[];
}

export async function sendEmails(messages: EmailMessage[]): Promise<EmailSendResult> {
  if (messages.length === 0) {
    return { provider: "skipped", sent: 0, failed: 0, previewUrls: [], ids: [] };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return sendWithResend(resendKey, messages);
  }

  const etherealUser = process.env.ETHEREAL_EMAIL_USER;
  const etherealPass = process.env.ETHEREAL_EMAIL_PASSWORD;
  if (etherealUser && etherealPass) {
    return sendWithEthereal(etherealUser, etherealPass, messages);
  }

  console.warn(
    "Email skipped: no provider configured (set RESEND_API_KEY or Ethereal credentials).",
  );
  return { provider: "skipped", sent: 0, failed: 0, previewUrls: [], ids: [] };
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
    previewUrls: [],
    ids,
  };
}

async function sendWithEthereal(
  user: string,
  pass: string,
  messages: EmailMessage[],
): Promise<EmailSendResult> {
  const transporter = nodemailer.createTransport({
    host: ETHEREAL_SMTP_HOST,
    port: ETHEREAL_SMTP_PORT,
    secure: false,
    auth: { user, pass },
  });

  const results = await Promise.allSettled(
    messages.map(async (message) => {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? "feedl <no-reply@feedl.app>",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return typeof previewUrl === "string" ? previewUrl : null;
    }),
  );

  const previewUrls: string[] = [];
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) {
        previewUrls.push(result.value);
      }
    } else {
      failed += 1;
      console.error(
        "Ethereal send failed:",
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  }

  // Ethereal'de gerçek teslimat geri bildirimi yok → ids null (webhook yok).
  return {
    provider: "ethereal",
    sent: results.length - failed,
    failed,
    previewUrls,
    ids: messages.map(() => null),
  };
}
