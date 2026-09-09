import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { subscriptions, workspaces } from "@/lib/db/schema";

// P0-1: Billing activation — checkout.completed sonrası kart, webhook DB'ye
// ulaşıp workspace'i Pro yapmadan sayfayı yenilemek yerine bu uçtan AKTİF
// durumu poll eder. Auth kontrollü (admin), workspace bağlamından çözülür.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz." },
        { status: 401 },
      );
    }
    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({
        plan: workspaces.plan,
        paddleSubscriptionId: workspaces.paddleSubscriptionId,
        paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!row) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 404 },
      );
    }
    // P0-1: in-app plan değişikliğinde (aylık↔yıllık) plan `pro` kalır; değişimi
    // doğrulamak için güncel subscription price_id gerekir (webhook'tan gelir).
    const [subRow] = await getDb()
      .select({ priceId: subscriptions.priceId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    return NextResponse.json({
      success: true,
      data: {
        plan: row.plan,
        priceId: subRow?.priceId ?? null,
        paddleSubscriptionId: row.paddleSubscriptionId,
        paddleSubscriptionStatus: row.paddleSubscriptionStatus,
      },
    });
  } catch (err) {
    console.error(
      "GET /api/paddle/status failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Durum alınamadı. Tekrar dene." },
      { status: 500 },
    );
  }
}
