import { NextResponse } from "next/server";

import { getAdminUserId } from "@/lib/auth/admin";
import { getWorkspaceId } from "@/lib/db/workspace";
import { deleteSampleData, hasSampleData } from "@/lib/db/sample-data";

// Sprint 68 — onboarding'de üretilen ÖRNEK veriyi siler.
//
// Yetki: getAdminUserId (owner/manager). Yalnız `is_sample=true` satırlara ve
// bu workspace'in önekli sentetik kullanıcılarına dokunur — gerçek veri GÜVENDE.
// GET: örnek veri var mı? (UI silme kartını buna göre gösterir.)

export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const present = await hasSampleData(await getWorkspaceId());
    return NextResponse.json({ success: true, data: { present } });
  } catch (err) {
    console.error(
      "GET /api/admin/sample-data failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Durum okunamadı." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    await deleteSampleData(await getWorkspaceId());
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(
      "DELETE /api/admin/sample-data failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Örnek veriler silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
