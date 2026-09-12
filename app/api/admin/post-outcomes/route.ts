import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getPlanLimits } from "@/lib/paddle";
import { postOutcomes, posts } from "@/lib/db/schema";
import { createOutcomeSchema, normalizeOutcomeInput } from "@/lib/post-outcome";

// 2026-09-12 (M6 ürün eksiği) — yayınlanan bir fikrin GERÇEKLEŞEN sonucu.
//
// Yetki: admin kademesi (owner + manager). Plan matrisi:
//  - YAZMA (POST) Pro'dur — outcome, gelir bağlamıyla aynı ürün değerinin
//    parçası (MRR girişi ve gelir skoru da Pro).
//  - OKUMA/SİLME plan kapısı YOKTUR: bir workspace Pro'yu bıraktığında kendi
//    kaydettiği veriye erişememesi ya da onu silememesi veri kilidi tuzağı
//    olurdu (bkz. `docs/free-pro_plans.md` — "Free'yi yapay olarak sakat
//    bırakma"). Bu yüzden sayfa listeyi her zaman gösterir, yalnız form kapalıdır.

// Fikrin bu workspace'e ait olduğunu doğrular. Gövdedeki `postId` istemciden
// gelir; workspace kontrolü olmadan başka bir kiracının fikrine outcome
// yazılabilirdi.
async function postBelongsToWorkspace(
  postId: string,
  workspaceId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);
  return Boolean(row);
}

// POST /api/admin/post-outcomes — sonuç kaydı ekle.
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    if ((await getPlanLimits()).key !== "pro") {
      return NextResponse.json(
        {
          success: false,
          error: "Sonuç kaydı Pro özelliğidir. Pro'ya geçerek kullan.",
        },
        { status: 403 },
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

    const parsed = createOutcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Sonuç bilgileri geçersiz.",
        },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const input = normalizeOutcomeInput(parsed.data);
    if (!(await postBelongsToWorkspace(input.postId, workspaceId))) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    const [row] = await getDb()
      .insert(postOutcomes)
      .values({
        workspaceId,
        postId: input.postId,
        outcomeType: input.outcomeType,
        // numeric kolona değer string olarak taşınır (drizzle numeric'i string
        // döner); null "veri yok" demektir — 0'dan AYRI.
        revenueDelta:
          input.revenueDelta === null ? null : String(input.revenueDelta),
        summary: input.summary,
        evidenceUrl: input.evidenceUrl,
        occurredAt: input.occurredAt,
        recordedBy: adminId,
      })
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    console.error(
      "POST /api/admin/post-outcomes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Sonuç kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/post-outcomes?id=... — sonuç kaydını sil.
// Plan kapısı yoktur (gerekçe: yukarıdaki not).
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    // `NextRequest.nextUrl` yerine `new URL(req.url)`: handler tipi düz
    // `Request` (diğer admin rotalarıyla aynı imza).
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Silinecek kayıt belirtilmedi." },
        { status: 400 },
      );
    }

    // `workspaceId` filtresi zorunlu: istemci başka bir kiracının kayıt
    // kimliğini tahmin etse bile silme o kiracıya dokunamaz.
    const deleted = await getDb()
      .delete(postOutcomes)
      .where(
        and(
          eq(postOutcomes.id, id),
          eq(postOutcomes.workspaceId, await getWorkspaceId()),
        ),
      )
      .returning({ id: postOutcomes.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: "Kayıt bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { id: deleted[0].id } });
  } catch (err) {
    console.error(
      "DELETE /api/admin/post-outcomes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Sonuç silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
