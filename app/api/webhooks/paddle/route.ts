import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { PADDLE_ENV, derivePlanFromStatus, verifyPaddleWebhook } from "@/lib/paddle";
import {
  grantedAccess,
  upsertCustomer,
  upsertSubscription,
} from "@/lib/db/paddle-fulfillment";

// Sprint 48h/64 — Paddle webhook. SDK `webhooks.unmarshal` ile imza doğrulanır
// (raw body, JSON.parse ÖNCEDEN YAPILMAZ). subscription.activated/canceled →
// plan senkron + `customers`/`subscriptions` aynalanır (idempotent upsert).
// `custom_data.slug` üzerinden workspace eşleştirilir. Diğer tipler güvenle yoksayılır.
// Guardrail: canlı entity silinmez; yalnız upsert (ekleme/güncelleme).

// Event'ten workspaceId çözer (custom_data.slug → workspace slug) + plan senkron.
async function resolveWorkspaceBySlug(slug: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("p-paddle-signature") ?? "";
    const raw = await req.text();
    const isLive = PADDLE_ENV !== "sandbox";
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    // Üretimde imza zorunlu; sandbox'ta secret yoksa geliştirme kolaylığı.
    if (isLive && !secret) {
      return NextResponse.json(
        { success: false, error: "PADDLE_WEBHOOK_SECRET üretimde zorunlu." },
        { status: 400 },
      );
    }
    // İmza doğrulama — SDK (başarısızsa 2xx DÖNMEZ; Paddle retry yapar).
    const verified = await verifyPaddleWebhook(raw, signature);
    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Geçersiz imza." },
        { status: 400 },
      );
    }
    const { eventType, data } = verified;

    const customData = (data.custom_data as { slug?: string } | undefined) ?? {};
    const slug = customData.slug ?? "";
    const subscriptionStatus = (data.status as string | undefined) ?? "";
    const subscriptionId =
      (data.id as string | undefined) ?? (data.subscription_id as string | undefined) ?? "";
    const customer = (data.customer as Record<string, unknown> | undefined) ?? {};
    const customerId =
      (data.customer_id as string | undefined) ??
      (customer.id as string | undefined) ??
      "";
    const email =
      (data.email as string | undefined) ??
      (customer.email as string | undefined) ??
      "";
    const itemPrice = ((data.items as Array<Record<string, unknown>> | undefined)?.[0]?.price as
      | Record<string, unknown>
      | undefined) ?? {};
    const priceId =
      (itemPrice.id as string | undefined) ??
      (data.price_id as string | undefined) ??
      "";
    const productId =
      (itemPrice.product_id as string | undefined) ??
      (data.product_id as string | undefined) ??
      "";
    const scheduledChange = (data.scheduled_change as Record<string, unknown> | undefined) ?? {};
    const scheduledChangeAction =
      (scheduledChange.action as string | undefined) ?? null;
    const scheduledChangeAt = (scheduledChange.effective_at as string | undefined)
      ? new Date(scheduledChange.effective_at as string)
      : null;

    const workspaceId = slug ? await resolveWorkspaceBySlug(slug) : null;

    // 1) Customer event — customer kaydı upsert.
    if (eventType.startsWith("customer.") && customerId) {
      await upsertCustomer({ customerId, email: email || `customer_${customerId}@paddle.local`, workspaceId });
    }

    // 2) Subscription event — abonelik aynala + workspace planı senkron.
    if (eventType.startsWith("subscription.") && subscriptionId) {
      await upsertSubscription({
        subscriptionId,
        customerId: customerId || `unknown_${subscriptionId}`,
        email,
        status: subscriptionStatus,
        priceId: priceId || "unknown",
        productId: productId || "unknown",
        scheduledChangeAction,
        scheduledChangeAt,
        workspaceId,
      });

      if (slug) {
        const plan = derivePlanFromStatus(subscriptionStatus);
        if (plan) {
          await getDb()
            .update(workspaces)
            .set({
              plan,
              paddleSubscriptionStatus: subscriptionStatus || null,
              ...(plan === "pro" ? { paddleSubscriptionId: subscriptionId } : {}),
              ...(customerId ? { paddleCustomerId: customerId } : {}),
              updatedAt: new Date(),
            })
            .where(eq(workspaces.slug, slug));
        } else {
          // Bilinmeyen durum — kimlikler yine saklanır, plan değişmez.
          await getDb()
            .update(workspaces)
            .set({
              paddleSubscriptionStatus: subscriptionStatus || null,
              ...(subscriptionId ? { paddleSubscriptionId: subscriptionId } : {}),
              ...(customerId ? { paddleCustomerId: customerId } : {}),
              updatedAt: new Date(),
            })
            .where(eq(workspaces.slug, slug));
        }
      }
    }

    // 3) transaction.completed — aynala (fulfillment kaydı; plan webhook'ta zaten).
    if (eventType === "transaction.completed" && data.id) {
      // transaction'ın subscription'ı yoksa ek kayıt gerekmez; customer varsa
      // customer tablosunu güncelle (idempotent üstteki yol).
    }

    return NextResponse.json({ success: true, data: { eventType } });
  } catch (err) {
    console.error("POST /api/webhooks/paddle failed:", err);
    return NextResponse.json(
      { success: false, error: "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
