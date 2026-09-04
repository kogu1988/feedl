import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { webhookDeliveries } from "@/lib/db/schema";
import type { WebhookEventName } from "@/lib/webhooks/dispatch";

// Sprint 43 (PM raporu §9 madde 6) — webhook dead-letter kuyruğu.
// Inngest teslimatı 3× retry eder; her deneme burada izlenir (aynı
// endpoint+olay+payload tek satır). Başarısız durum "failed" kalır ve
// admin'in inceleyip yeniden tetikleyebileceği dead-letter kaydıdır.

export interface DeliveryUpsert {
  workspaceId: string;
  endpointId: string;
  event: WebhookEventName;
  payload: unknown;
}

async function touch(
  upsert: DeliveryUpsert,
  set: { status: string; lastError: string | null },
) {
  try {
    await getDb()
      .insert(webhookDeliveries)
      .values({
        workspaceId: upsert.workspaceId,
        endpointId: upsert.endpointId,
        event: upsert.event,
        payload: upsert.payload as never,
        status: set.status,
        attempts: 1,
        lastError: set.lastError,
      })
      .onConflictDoUpdate({
        target: [
          webhookDeliveries.endpointId,
          webhookDeliveries.event,
          webhookDeliveries.payload,
        ],
        set: {
          status: set.status,
          lastError: set.lastError,
          attempts: sql`${webhookDeliveries.attempts} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch {
    // Dead-letter kaydı best-effort: teslimat zincirini bozmasın.
  }
}

export async function recordDeliveryFailure(
  upsert: DeliveryUpsert,
  error: string,
) {
  await touch(upsert, { status: "failed", lastError: error.slice(0, 2000) });
}

export async function markDeliveryDelivered(upsert: DeliveryUpsert) {
  await touch(upsert, { status: "delivered", lastError: null });
}

// Admin için başarısız (dead-letter) ve son teslimatlar.
export async function listDeadLetters(limit = 20) {
  return getDb()
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
    .where(and(eq(webhookDeliveries.workspaceId, await getWorkspaceId())))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}
