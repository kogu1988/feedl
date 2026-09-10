import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { PADDLE_ENV, derivePlanFromStatus, verifyPaddleWebhook, fetchCustomerEmail } from "@/lib/paddle";
import { upsertCustomer, upsertSubscription } from "@/lib/db/paddle-fulfillment";

// Sprint 48h/64 — Paddle webhook. SDK `webhooks.unmarshal` ile imza doğrulanır
// (raw body, JSON.parse ÖNCEDEN YAPILMAZ). subscription.activated/canceled →
// plan senkron + `customers`/`subscriptions` aynalanır (idempotent upsert).
// Workspace eşleştirme `custom_data.workspace_id` (immutable UUID) üzerinden
// yapılır; eski checkout'lar için `custom_data.slug` fallback kalır. Diğer
// tipler güvenle yoksayılır. Guardrail: canlı entity silinmez; yalnız upsert.

// Event'ten workspaceId çözer. Öncelik Custom Data'daki immutable `workspace_id`
// (UUID); o yoksa eski `slug` fallback (geriye dönük uyum). Slug kullanıcıya
// dönük/değişebilir olduğundan billing identity olarak UUID tercih edilir.
async function resolveWorkspaceId(input: {
  workspaceId?: string | null;
  slug?: string | null;
}): Promise<string | null> {
  // 1) Immutable workspace UUID (P0-2 — billing identity slug DEĞİL).
  if (input.workspaceId) {
    const [byId] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceId))
      .limit(1);
    if (byId) return byId.id;
  }
  // 2) Slug fallback (eski checkout'lar).
  if (input.slug) {
    const [bySlug] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, input.slug))
      .limit(1);
    if (bySlug) return bySlug.id;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    // Paddle's webhook signature header is `Paddle-Signature` (NOT `p-paddle-
    // signature`). Header names are case-insensitive but the name must match.
    const signature = req.headers.get("paddle-signature") ?? "";
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
    // İmza doğrulama — SDK `isSignatureValid` (HMAC) + lenient parse.
    // Başarısızsa 2xx DÖNMEZ; Paddle retry yapar. Secret loglanmaz.
    const verified = await verifyPaddleWebhook(raw, signature);
    console.log("[paddle-webhook] verified", !!verified, "event", verified?.eventType ?? "");
    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Geçersiz imza." },
        { status: 400 },
      );
    }
    const { eventType, data } = verified;

    const customData =
      (data.custom_data as { slug?: string; workspace_id?: string } | undefined) ?? {};
    const slug = customData.slug ?? "";
    const rawWorkspaceId = customData.workspace_id ?? "";
    const subscriptionStatus = (data.status as string | undefined) ?? "";
    const subscriptionId =
      (data.id as string | undefined) ?? (data.subscription_id as string | undefined) ?? "";
    const customer = (data.customer as Record<string, unknown> | undefined) ?? {};
    const customerId =
      (data.customer_id as string | undefined) ??
      (customer.id as string | undefined) ??
      "";
    let email =
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

    const workspaceId = await resolveWorkspaceId({
      workspaceId: rawWorkspaceId || null,
      slug: slug || null,
    });

    // subscription.* event'leri email taşımaz; eksikse Paddle API'den doldur.
    if (!email && customerId && eventType.startsWith("subscription.")) {
      email = (await fetchCustomerEmail(customerId)) ?? "";
    }

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

      // Plan senkronu — workspace'i UUID ile güncelle (immutable identity).
      if (workspaceId) {
        const plan = derivePlanFromStatus(subscriptionStatus);
        if (plan) {
          // Plan Pro'ya YÜKSELDİYSE bayat içgörü cache'ini temizle: free
          // dönemde kilitli/boş kalan cache, Pro sayfada gerçek içgörü
          // sanılıp gösterilmesin (yaşandı: sayfada hem "Pro plan özelliğidir"
          // metni hem "Yenile" butonu görünüyordu). Yalnız GEÇİŞTE temizlenir;
          // her yenileme webhook'u meşru cache'i silmez.
          let resetInsights = false;
          if (plan === "pro") {
            const [current] = await getDb()
              .select({ plan: workspaces.plan })
              .from(workspaces)
              .where(eq(workspaces.id, workspaceId))
              .limit(1);
            resetInsights = current?.plan !== "pro";
          }
          await getDb()
            .update(workspaces)
            .set({
              plan,
              paddleSubscriptionStatus: subscriptionStatus || null,
              ...(plan === "pro" ? { paddleSubscriptionId: subscriptionId } : {}),
              ...(customerId ? { paddleCustomerId: customerId } : {}),
              ...(resetInsights
                ? { corpusInsights: null, corpusInsightsStatus: "idle" }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspaceId));
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
            .where(eq(workspaces.id, workspaceId));
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
