import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { getPaddle } from "@/lib/paddle";

// Sprint 63x (in-app plan change) — plan değişikliği önizleme. Mevcut Pro
// aboneliği için hedef fiyatı (`priceId`) alıp Paddle `previewUpdate` ile
// proration farkını hesaplar. Yalnızca admin. Kullanıcı bu sonucu in-app
// görüp onaylar — Paddle sayfasına gitmesi gerekmez.
export const dynamic = "force-dynamic";

function money(
  v: { amount?: unknown; currencyCode?: string } | null | undefined,
) {
  if (!v) return null;
  const amount =
    typeof v.amount === "number" ? v.amount : Number(v.amount ?? 0);
  const currency = v.currencyCode ?? "USD";
  return { amount: Number.isFinite(amount) ? amount : 0, currency };
}

// .totals alanının total/currencyCode'sini Money benzeri nesneye çevirir.
function totals(
  t: { total?: unknown; currencyCode?: string } | null | undefined,
) {
  if (!t) return null;
  return money({ amount: t.total, currencyCode: t.currencyCode });
}

export async function GET(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz." },
        { status: 401 },
      );
    }

    const targetPriceId = new URL(req.url).searchParams.get("priceId");
    if (!targetPriceId) {
      return NextResponse.json(
        { success: false, error: "targetPriceId gerekli." },
        { status: 400 },
      );
    }

    const paddle = getPaddle();
    if (!paddle) {
      return NextResponse.json(
        { success: false, error: "Paddle yapılandırılmamış." },
        { status: 500 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({ subscriptionId: workspaces.paddleSubscriptionId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!row?.subscriptionId) {
      return NextResponse.json(
        { success: false, error: "Aktif Paddle aboneliği yok." },
        { status: 404 },
      );
    }

    // Hedef fiyatı uygula: mevcut base planı çıkar, hedefi ekle (quantity 1).
    // Mevcut abonelik yalnız tek fiyatlı (tek plan) olduğundan items=hedef.
    const preview = await paddle.subscriptions.previewUpdate(row.subscriptionId, {
      prorationBillingMode: "prorated_immediately",
      items: [{ priceId: targetPriceId, quantity: 1 }],
    });

    return NextResponse.json({
      success: true,
      data: {
        currentPriceId: preview.items[0]?.price?.id ?? null,
        currentProductName: preview.items[0]?.product?.name ?? null,
        targetPriceId,
        // Proration: bu değişiklik yapılırsa bugün tahsil/credit.
        updateSummary: {
          credit: money(preview.updateSummary?.credit),
          charge: money(preview.updateSummary?.charge),
          result: preview.updateSummary?.result?.action ?? null,
        },
        immediate: {
          total: totals(preview.immediateTransaction?.details?.totals),
          billingPeriod: preview.immediateTransaction?.billingPeriod
            ? {
                startsAt: preview.immediateTransaction.billingPeriod.startsAt,
                endsAt: preview.immediateTransaction.billingPeriod.endsAt,
              }
            : null,
        },
        next: {
          total: totals(preview.nextTransaction?.details?.totals),
          billingPeriod: preview.nextTransaction?.billingPeriod
            ? {
                startsAt: preview.nextTransaction.billingPeriod.startsAt,
                endsAt: preview.nextTransaction.billingPeriod.endsAt,
              }
            : null,
        },
        recurring: totals(preview.recurringTransactionDetails?.totals),
        effective: preview.items?.[0]?.price?.billingCycle
          ? { interval: preview.items[0].price.billingCycle.interval }
          : null,
      },
    });
  } catch (err) {
    console.error(
      "GET /api/paddle/subscription/preview failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Önizleme alınamadı." },
      { status: 500 },
    );
  }
}
