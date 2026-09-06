import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { getPaddle } from "@/lib/paddle";

// Sprint 63x (in-app plan change) — plan değişikliğini uygula. Kullanıcı
// önizlemeyi onaylayınca bu uç Paddle `subscriptions.update` çağırır;
// Paddle webhook'u (`subscription.updated`) planı senkronlar ve in-app
// kullanıcı sayfasından çıkmaz. Proration `prorated_immediately` (upgrade)
// — downgrade için aynı düşük fiyata düşer, Paddle krediyi yönetir.
export const dynamic = "force-dynamic";

const changeSchema = z.object({
  priceId: z.string().min(1),
  prorationBillingMode: z
    .enum(["prorated_immediately", "full_immediately", "prorated_next_billing_period", "full_next_billing_period"])
    .optional()
    .default("prorated_immediately"),
});

export async function PATCH(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz." },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }

    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz plan değişikliği." },
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

    const updated = await paddle.subscriptions.update(row.subscriptionId, {
      prorationBillingMode: parsed.data.prorationBillingMode,
      items: [{ priceId: parsed.data.priceId, quantity: 1 }],
    });

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: updated.id,
        status: updated.status,
        nextBilledAt: updated.nextBilledAt,
      },
    });
  } catch (err) {
    console.error(
      "PATCH /api/paddle/subscription failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Plan değiştirilemedi." },
      { status: 500 },
    );
  }
}
