import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { PADDLE_ENV, verifyPaddleSignature } from "@/lib/paddle";

// Sprint 48h (Faz 5) — Paddle webhook. subscription.activated → plan='pro',
// subscription.canceled → plan='free'. İmza doğrulanır (PADDLE_WEBHOOK_SECRET
// varsa; yoksa geliştirmede yoksayılır ama üretimde zorunlu). Workspace'i
// custom_data.slug üzerinden eşleştirir (checkout açılırken custom_data'yı
// Paddle.js'e geçiririz — billing-manager'da custom_data slug ile).
// Not: webhook secret Paddle dashboard'da notification destination
// oluşturulunca alınır; .env'e PADDLE_WEBHOOK_SECRET olarak eklenir.

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("p-paddle-signature") ?? "";
    const raw = await req.text();

    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    const isLive = PADDLE_ENV !== "sandbox";
    // Üretimde imza ZORUNLUDUR; sandbox'ta secret yoksa geliştirme kolaylığı.
    if (isLive && !secret) {
      return NextResponse.json(
        { success: false, error: "PADDLE_WEBHOOK_SECRET üretimde zorunlu." },
        { status: 400 },
      );
    }
    if (secret && !verifyPaddleSignature(raw, signature)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz imza." },
        { status: 400 },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz JSON." },
        { status: 400 },
      );
    }

    const eventType =
      (payload as { event_type?: string }).event_type ?? "";
    const data =
      (payload as { data?: Record<string, unknown> }).data ?? {};
    const customData =
      (data.custom_data as { slug?: string } | undefined) ?? {};
    const slug = customData.slug;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "custom_data.slug eksik." },
        { status: 400 },
      );
    }

    // Sprint 52/60: planı aboneliğin `status` alanından türet (tek gerçek).
    // trialing/active → pro; canceled/paused/past_due/dunned/expired → free.
    // Sprint 60: `paddleSubscriptionStatus` da saklanır — billing sayfası
    // gerçek durumu (ödeme gecikmesi/iptal) gösterir.
    const subscriptionStatus = (data.status as string | undefined) ?? "";
    let plan: "pro" | "free" | null = null;
    if (["trialing", "active"].includes(subscriptionStatus)) {
      plan = "pro";
    } else if (
      ["canceled", "paused", "past_due", "dunned", "expired"].includes(subscriptionStatus)
    ) {
      plan = "free";
    }

    if (!plan) {
      // Bilinmeyen/diğer olaylar (örn. subscription.updated, price change)
      // yoksayılır; kimlikler yine saklanır (durum kaybolmaz).
      const subscriptionId =
        (data.id as string | undefined) ??
        (data.subscription_id as string | undefined) ??
        null;
      const customerId = (data.customer_id as string | undefined) ?? null;
      if (subscriptionStatus && (subscriptionId || customerId)) {
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
      return NextResponse.json({ success: true, data: { ignored: eventType } });
    }

    const subscriptionId =
      (data.id as string | undefined) ??
      (data.subscription_id as string | undefined) ??
      null;
    const customerId = (data.customer_id as string | undefined) ?? null;

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

    return NextResponse.json({ success: true, data: { plan, slug, status: subscriptionStatus } });
  } catch (err) {
    console.error("POST /api/webhooks/paddle failed:", err);
    return NextResponse.json(
      { success: false, error: "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
