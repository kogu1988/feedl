import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { customers, subscriptions } from "@/lib/db/schema";
import { getPaddle } from "@/lib/paddle";

// Sprint 63x (canlı hazırlık) — Paddle müşteri portalı oturumu. Statik bir
// portal URL (env) yerine, abonelik için zaman sınırlı + doğru müşteriye
// bağlı güvenli portal URL üretir (Paddle `customerPortalSessions`). Yalnızca
// admin; Paddle'da yazma kapsamı gerekmez (portal oturumu read-only üretir).
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
    const paddle = getPaddle();
    if (!paddle) {
      return NextResponse.json(
        { success: false, error: "Paddle yapılandırılmamış." },
        { status: 500 },
      );
    }

    // Sprint 64: customer + subscription'ı fulfillment tablolarından çöz
    // (workspace bazlı). Paddle customer portalı abonelik + müşteri ister.
    const [customerRow] = await getDb()
      .select({ customerId: customers.customerId })
      .from(customers)
      .where(eq(customers.workspaceId, workspaceId))
      .limit(1);
    const [subRow] = await getDb()
      .select({ subscriptionId: subscriptions.subscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    const customerId = customerRow?.customerId ?? null;
    const subscriptionId = subRow?.subscriptionId ?? null;
    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { success: false, error: "Aktif Paddle aboneliği yok." },
        { status: 404 },
      );
    }

    const session = await paddle.customerPortalSessions.create(
      customerId,
      [subscriptionId],
    );
    const url = session.urls.general.overview;
    if (!url) {
      return NextResponse.json(
        { success: false, error: "Portal URL üretilemedi." },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: { url } });
  } catch (err) {
    console.error(
      "GET /api/paddle/portal failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Portal hazırlanamadı. Tekrar dene." },
      { status: 500 },
    );
  }
}
