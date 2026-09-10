import "server-only";

import { getDb } from "@/lib/db";
import { customers, subscriptions } from "@/lib/db/schema";

// Sprint 64 (Paddle fulfillment) — canlı webhook event'lerini abonelik/tablolara
// aynalar (idempotent upsert, Paddle ID anahtar). `workspaces` plan alanı ile
// birlikte çalışır; `workspaceId` custom_data.slug üzerinden çözülür.

// Erişim veren durumlar: active + trialing. `scheduled_change` (iptal/pause)
// erişimi HEMEN kesmez — yalnız fiili `status` dikkate alınır.
export function grantedAccess(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export async function upsertCustomer(input: {
  customerId: string;
  email: string;
  workspaceId?: string | null;
}): Promise<void> {
  await getDb()
    .insert(customers)
    .values({
      customerId: input.customerId,
      email: input.email,
      workspaceId: input.workspaceId ?? null,
    })
    .onConflictDoUpdate({
      target: customers.customerId,
      set: {
        email: input.email,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function upsertSubscription(input: {
  subscriptionId: string;
  customerId: string;
  email?: string | null;
  status: string;
  priceId: string;
  productId: string;
  scheduledChangeAction?: string | null;
  scheduledChangeAt?: Date | null;
  workspaceId?: string | null;
}): Promise<void> {
  // Paddle `customer_id` her event'te olmayabilir; customer kaydı yoksa sadece
  // subscription yazılamaz (FK) — customer'ı önce garanti et.
  await getDb()
    .insert(customers)
    .values({
      customerId: input.customerId,
      email: input.email ?? `customer_${input.customerId}@paddle.local`,
      workspaceId: input.workspaceId ?? null,
    })
    .onConflictDoUpdate({
      target: customers.customerId,
      set: {
        ...(input.email ? { email: input.email } : {}),
        updatedAt: new Date(),
      },
    });

  await getDb()
    .insert(subscriptions)
    .values({
      subscriptionId: input.subscriptionId,
      customerId: input.customerId,
      workspaceId: input.workspaceId ?? null,
      status: input.status,
      priceId: input.priceId,
      productId: input.productId,
      scheduledChangeAction: input.scheduledChangeAction ?? null,
      scheduledChangeAt: input.scheduledChangeAt ?? null,
    })
    .onConflictDoUpdate({
      target: subscriptions.subscriptionId,
      set: {
        customerId: input.customerId,
        status: input.status,
        priceId: input.priceId,
        productId: input.productId,
        scheduledChangeAction: input.scheduledChangeAction ?? null,
        scheduledChangeAt: input.scheduledChangeAt ?? null,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        updatedAt: new Date(),
      },
    });
}

// Bir subscription'ın erişim verip vermediğini (grantedAccess) döndürür;
// webhook/plan kararı için kullanılır (scheduled_change dikkate alınmaz).
export function subscriptionGrantsAccess(status: string | null | undefined): boolean {
  return grantedAccess(status);
}
