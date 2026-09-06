import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
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

    const [row] = await getDb()
      .select({
        subscriptionId: workspaces.paddleSubscriptionId,
        customerId: workspaces.paddleCustomerId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!row?.subscriptionId || !row?.customerId) {
      return NextResponse.json(
        { success: false, error: "Aktif Paddle aboneliği yok." },
        { status: 404 },
      );
    }

    const session = await paddle.customerPortalSessions.create(
      row.customerId,
      [row.subscriptionId],
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
