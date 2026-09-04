import "server-only";

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { webhookDeliveries } from "@/lib/db/schema";

// Sprint 43 (PM raporu §9 madde 6) — dead-letter görünümü. Başarısız
// teslimatlar (status=failed) ve son teslimatlar admin'e listelenir.
// ?status=failed ile yalnızca dead-letter'lar çekilir.

export async function GET(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
    );

    const conditions = [
      eq(webhookDeliveries.workspaceId, await getWorkspaceId()),
    ];
    if (statusParam === "failed" || statusParam === "delivered") {
      conditions.push(eq(webhookDeliveries.status, statusParam));
    }

    const rows = await getDb()
      .select({
        id: webhookDeliveries.id,
        endpointId: webhookDeliveries.endpointId,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        lastError: webhookDeliveries.lastError,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .where(and(...conditions))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/webhooks/deliveries failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Teslimatlar alınamadı." },
      { status: 500 },
    );
  }
}
