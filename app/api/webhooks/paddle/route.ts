import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import {
  PADDLE_ENV,
  derivePlanFromStatus,
  verifyPaddleWebhook,
  fetchCustomerEmail,
  paddleWebhookDataSchema,
  type PaddleWebhookData,
} from "@/lib/paddle";
import { upsertCustomer, upsertSubscription } from "@/lib/db/paddle-fulfillment";

// Sprint 48h/64 — Paddle webhook. İmza SDK `isSignatureValid` (HMAC) ile
// doğrulanır; ardından raw body LENIENT parse edilir. SDK `unmarshal` (imza +
// katı event constructor) gerçek Paddle payload'larını bazen `.map` şema
// hatasıyla reddettiği için bilinçli olarak KULLANILMAZ — güven sınırı imzadır
// (bkz. lib/paddle.ts). `subscription.activated/canceled` → plan senkron +
// `customers`/`subscriptions` aynalanır (idempotent upsert).
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

    // Şema parse'ı ASLA patlamaz (her yaprak `.catch(undefined)`) → beklenmeyen
    // bir Paddle payload'ı webhook'u düşürmez. Alanlar artık cast'siz ve tipli.
    const parsedData = paddleWebhookDataSchema.safeParse(data);
    const d: PaddleWebhookData = parsedData.success ? parsedData.data : {};

    const slug = d.custom_data?.slug ?? "";
    const rawWorkspaceId = d.custom_data?.workspace_id ?? "";
    const subscriptionStatus = d.status ?? "";
    const subscriptionId = d.id ?? d.subscription_id ?? "";
    const customerId = d.customer_id ?? d.customer?.id ?? "";
    let email = d.email ?? d.customer?.email ?? "";
    const itemPrice = d.items?.[0]?.price;
    const priceId = itemPrice?.id ?? d.price_id ?? "";
    const productId = itemPrice?.product_id ?? d.product_id ?? "";
    const scheduledChangeAction = d.scheduled_change?.action ?? null;
    const scheduledChangeAt = d.scheduled_change?.effective_at
      ? new Date(d.scheduled_change.effective_at)
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
          // Mevcut satır: hem Pro'ya geçiş tespiti (bayat içgörü cache'i)
          // hem dunning grace için durum değişim anı gerekir (denetim K3).
          const [current] = await getDb()
            .select({
              plan: workspaces.plan,
              paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
            })
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId))
            .limit(1);

          // Plan Pro'ya YÜKSELDİYSE bayat içgörü cache'ini temizle: free
          // dönemde kilitli/boş kalan cache, Pro sayfada gerçek içgörü
          // sanılıp gösterilmesin (yaşandı: sayfada hem "Pro plan özelliğidir"
          // metni hem "Yenile" butonu görünüyordu). Yalnız GEÇİŞTE temizlenir;
          // her yenileme webhook'u meşru cache'i silmez.
          const resetInsights = plan === "pro" && current?.plan !== "pro";

          // Durum GERÇEKTEN değiştiyse zaman damgasını yaz: grace bu andan
          // hesaplanır ve her webhook damgayı sıfırlamamalı (aksi halde sorun
          // sürdükçe grace hiç bitmezdi — tekrar denemeler yeni olay üretir).
          const nextStatus = subscriptionStatus || null;
          const statusChanged =
            current?.paddleSubscriptionStatus !== nextStatus;

          await getDb()
            .update(workspaces)
            .set({
              plan,
              paddleSubscriptionStatus: nextStatus,
              ...(statusChanged ? { paddleStatusChangedAt: new Date() } : {}),
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

    // 3) `transaction.completed` bilinçli olarak İŞLENMEZ: plan senkronu zaten
    //    `subscription.*` webhook'unda yapılır, müşteri kaydı `customer.*` ve
    //    abonelik upsert'i ile aynalanır. (2026-09-12: içi boş bir `if` bloğu
    //    kaldırıldı — davranış aynı, niyet açık.)

    return NextResponse.json({ success: true, data: { eventType } });
  } catch (err) {
    console.error("POST /api/webhooks/paddle failed:", err);
    return NextResponse.json(
      { success: false, error: "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
