import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

// Sağlayıcı seçimi (plan.md Sprint 6): RESEND_API_KEY varsa production'da
// Resend kullanılır; yoksa Ethereal.email SMTP ile test edilir (gerçek teslimat
// yok, mesajlar Ethereal gelen kutusunda önizlenir). İkisi de yoksa e-posta
// atlanır — bildirim hatası ana akışı bozmamalı.

const ETHEREAL_SMTP_HOST = "smtp.ethereal.email";
const ETHEREAL_SMTP_PORT = 587;

// Resend'de doğrulanmış domain olana kadar paylaşılan test göndericisi;
// EMAIL_FROM ile override edilebilir (domain bağlandıktan sonra "feedl <no-reply@feedl.co>").
const DEFAULT_FROM = "feedl <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  provider: "resend" | "ethereal" | "skipped";
  sent: number;
  failed: number;
  // Ethereal'de her mesajın web önizleme adresi (testte kanıt olarak kullanılır).
  previewUrls: string[];
}

export async function sendEmails(messages: EmailMessage[]): Promise<EmailSendResult> {
  if (messages.length === 0) {
    return { provider: "skipped", sent: 0, failed: 0, previewUrls: [] };
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
  return { provider: "skipped", sent: 0, failed: 0, previewUrls: [] };
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
    })),
  );

  if (error) {
    throw new Error(`Resend batch failed: ${error.message}`);
  }

  return {
    provider: "resend",
    sent: data?.length ?? 0,
    failed: 0,
    previewUrls: [],
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
        from: process.env.EMAIL_FROM ?? "feedl <no-reply@feedl.co>",
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

  return {
    provider: "ethereal",
    sent: results.length - failed,
    failed,
    previewUrls,
  };
}
