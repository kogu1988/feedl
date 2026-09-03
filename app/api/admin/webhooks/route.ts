import "server-only";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { generateWebhookSecret } from "@/lib/api-keys";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { webhookEndpoints } from "@/lib/db/schema";

// Sprint 34 — admin webhook endpoint yönetimi. Secret sunucuda üretilir ve
// YALNIZCA oluşturma yanıtında bir kez döner; listede yer almaz. Teslimat
// Inngest "send-webhooks" fonksiyonundan HMAC imzalı yapılır.

const WEBHOOK_EVENTS = [
  "post.created",
  "post.status_changed",
  "comment.created",
] as const;

const createSchema = z.object({
  url: z.url("Geçerli bir URL gerekli."),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "En az bir olay seçilmeli.")
    .max(WEBHOOK_EVENTS.length),
});

// GET /api/admin/webhooks — kayıtlı endpoint'leri listele.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rows = await getDb()
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        active: webhookEndpoints.active,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .orderBy(desc(webhookEndpoints.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/webhooks failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Webhook'lar yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/webhooks — yeni endpoint kaydet; secret bir kez döner.
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçerli bir URL ve en az bir olay seçilmeli." },
        { status: 400 },
      );
    }

    const secret = generateWebhookSecret();
    const [created] = await getDb()
      .insert(webhookEndpoints)
      .values({
        workspaceId: await getWorkspaceId(),
        url: parsed.data.url,
        events: [...parsed.data.events],
        secret,
      })
      .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url });

    return NextResponse.json(
      { success: true, data: { ...created, secret } },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/webhooks failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Webhook kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/webhooks?id=... — endpoint'i sil.
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rawId = new URL(req.url).searchParams.get("id") ?? "";
    const parsed = z.uuid().safeParse(rawId);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz webhook kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, parsed.data))
      .returning({ id: webhookEndpoints.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Webhook bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/webhooks failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Webhook silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
