import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { emailDeliveries, users } from "@/lib/db/schema";
import { deriveEmailStatus, marksSuppressed } from "@/lib/email/deliverability";

// Sprint 63v (deliverability) — Resend teslimat webhook'u. Resend olayları:
//   email.sent / email.delivered / email.bounced / email.complained
// `data.email_id` (Resend message id) ile email_deliveries.provider_id eşleşir →
// durum güncellenir. HARD bounce / complaint → kullanıcının e-posta tercihleri
// kapatılır (geçersiz adres/spam şikâyeti = gönderen itibarı riski).
// Resend webhook'ları imza taşımaz → RESEND_WEBHOOK_SECRET ile URL'de `?t=`
// veya `x-feedl-resend-token` header'ı (çift güvenlik) zorunludur.

// Token'ları zaman sabitiyle karşılaştır (brute-force'a karşı).
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("t") ?? "";
  const headerToken = req.headers.get("x-feedl-resend-token") ?? "";
  return (
    Boolean(queryToken && timingSafeEqualStr(queryToken, secret)) ||
    Boolean(headerToken && timingSafeEqualStr(headerToken, secret))
  );
}


export async function POST(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz webhook." },
        { status: 401 },
      );
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz JSON." },
        { status: 400 },
      );
    }

    const type = (payload as { type?: string }).type ?? "";
    const data = (payload as { data?: Record<string, unknown> }).data ?? {};
    const emailId = (data.email_id as string | undefined) ?? (data.id as string | undefined) ?? null;
    const status = deriveEmailStatus(type);

    // Bilinmeyen olay türü — sessiz onayla (Resend yeni olay ekleyebilir).
    if (!status || !emailId) {
      return NextResponse.json({ success: true, data: { ignored: type } });
    }

    const errorText = status === "bounced"
      ? typeof data.bounce === "object" && data.bounce
        ? ((data.bounce as { reason?: string }).reason ?? null)
        : null
      : null;

    // Eşleşen teslimat kaydını bul (provider_id = Resend message id).
    const [delivery] = await getDb()
      .select({
        id: emailDeliveries.id,
        userId: emailDeliveries.userId,
        status: emailDeliveries.status,
      })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerId, emailId))
      .limit(1);

    if (!delivery) {
      // Correlation yok — kayıt eski/düz (provider_id'siz) ya da test. İgnore.
      return NextResponse.json({ success: true, data: { unmatched: true } });
    }

    // Durumu güncelle (ileri duruma geri düşme).
    const downgrade = status === "bounced" || status === "complained";
    const setStatus =
      downgrade || delivery.status === "sent" ? status : delivery.status;

    await getDb()
      .update(emailDeliveries)
      .set({
        status: setStatus,
        error: errorText ?? null,
        deliveredAt: status === "delivered" ? new Date() : emailDeliveries.deliveredAt,
        bouncedAt: status === "bounced" ? new Date() : emailDeliveries.bouncedAt,
        complainedAt: status === "complained" ? new Date() : emailDeliveries.complainedAt,
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, delivery.id));

    // Hard bounce / complaint → kullanıcı bildirim tercihlerini kapat
    // (geçersiz adres = gönderilemez; şikâyet = spam riski). Best-effort.
    // `marksSuppressed` HAM olay türünü alır — `email.failed` geçici olabileceği
    // için kapama yapmaz; yalnız hard `email.bounced` / `email.complained`.
    if (status === "bounced" || status === "complained") {
      const bounceType =
        status === "bounced" && typeof data.bounce === "object" && data.bounce
          ? ((data.bounce as { type?: string }).type ?? null)
          : null;
      // "bounced" (kalıcı/hard) veya "spam complaint" ise bildirimi kapat.
      // transient/problem kategorileri (soft bounce) kapatma — kalıcı değil.
      const hard = marksSuppressed(type, bounceType);
      // B10: changelog anonim abonede userId null olabilir → users yok.
      if (hard && delivery.userId) {
        await getDb()
          .update(users)
          .set({
            emailStatusUpdates: false,
            emailComments: false,
            updatedAt: new Date(),
          })
          .where(eq(users.id, delivery.userId));
      }
    }

    return NextResponse.json({ success: true, data: { type, status, emailId } });
  } catch (err) {
    console.error("POST /api/webhooks/resend failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
