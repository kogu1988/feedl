import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import {
  deliverWebhook,
  type WebhookEventName,
  type WebhookEndpointRow,
} from "@/lib/webhooks/dispatch";
import { markDeliveryDelivered } from "@/lib/webhooks/delivery-log";

// Sprint 43 (PM raporu §9 madde 6) — dead-letter yeniden tetikleme. Kayıtlı
// payload ile aynı endpoint'e yeniden imzalı teslimat yapar; başarılıysa
// kaydı delivered'a çeker.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const deliveryId = z.uuid().safeParse(id);
    if (!deliveryId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz teslimat kimliği." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [delivery] = await getDb()
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId.data),
          eq(webhookDeliveries.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!delivery) {
      return NextResponse.json(
        { success: false, error: "Teslimat bulunamadı." },
        { status: 404 },
      );
    }

    const [endpoint] = await getDb()
      .select({ id: webhookEndpoints.id, url: webhookEndpoints.url, secret: webhookEndpoints.secret })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, delivery.endpointId),
          eq(webhookEndpoints.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!endpoint || !endpoint.secret) {
      return NextResponse.json(
        { success: false, error: "Endpoint bulunamadı." },
        { status: 404 },
      );
    }

    const payload = delivery.payload as unknown;
    await deliverWebhook(
      { id: endpoint.id, url: endpoint.url, secret: endpoint.secret } as WebhookEndpointRow,
      delivery.event as WebhookEventName,
      payload,
    );

    await markDeliveryDelivered({
      workspaceId,
      endpointId: delivery.endpointId,
      event: delivery.event as WebhookEventName,
      payload,
    });

    return NextResponse.json({ success: true, data: { id: delivery.id } });
  } catch (err) {
    console.error(
      "POST /api/admin/webhooks/deliveries/[id]/replay failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Yeniden teslimat başarısız." },
      { status: 502 },
    );
  }
}
