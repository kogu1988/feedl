import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { planFromString, verifyPaddleSignature } from "@/lib/paddle";

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

    // subscription.activated / subscription.updated (active) → pro;
    // subscription.canceled / subscription.past_due → free.
    const activate = eventType === "subscription.activated" || eventType === "subscription.updated";
    const cancel = eventType === "subscription.canceled" || eventType === "subscription.past_due";

    const plan = activate ? "pro" : cancel ? "free" : null;
    if (!plan) {
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
        ...(activate ? { paddleSubscriptionId: subscriptionId } : {}),
        ...(customerId ? { paddleCustomerId: customerId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.slug, slug));

    return NextResponse.json({ success: true, data: { plan, slug } });
  } catch (err) {
    console.error("POST /api/webhooks/paddle failed:", err);
    return NextResponse.json(
      { success: false, error: "Webhook işlenemedi." },
      { status: 500 },
    );
  }
}
