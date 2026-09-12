import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getOwnerUserId } from "@/lib/auth/admin";
import { buildWorkspaceExport } from "@/lib/db/data-export";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// GET /api/admin/data-export — workspace'in tüm verisini JSON olarak indir
// (denetim #8b; GDPR/KVKK veri taşınabilirliği).
//
// Yetki: OWNER-ONLY. Dışa aktarım müşteri verisinin tamamını içerdiği için
// toplu veri sızdırma yüzeyidir; manager ("admin") bile indiremez — "owner =
// ürünü satın alan" kararı (bkz. lib/auth/admin.ts).
//
// Plan kapısı YOKTUR: veri taşınabilirliği yasal bir haktır, ücretli özellik
// değildir (CSV dışa aktarma `/api/admin/export` Pro kapısını korumaya devam
// eder — o bir ürün özelliğidir, bu bir uyum yükümlülüğüdür).
export async function GET() {
  try {
    const ownerId = await getOwnerUserId();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için workspace sahibi (owner) yetkisi gerekir." },
        { status: 403 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const payload = await buildWorkspaceExport(workspaceId);

    // Dosya adı: slug + tarih (tarayıcı indirmeyi bu adla kaydeder).
    const [meta] = await getDb()
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    const slug = (meta?.slug ?? "workspace").replace(/[^a-z0-9-]/gi, "-");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="feedl-${slug}-${date}.json"`,
        // Kişisel veri içerir: ara katman/tarayıcı önbelleğine yazılmasın.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error(
      "GET /api/admin/data-export failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Veri dışa aktarılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
