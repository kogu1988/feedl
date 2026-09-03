import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import { mergePosts } from "@/lib/post-merge";

// POST /api/admin/inbox/[suggestionId] — AI önerisi kararı (sadece admin).
// action=approve: Sprint 20 merge CTE'si (lib/post-merge) çalışır; kaynak
// fikir hedefe birleştirilir, öneri approved işaretlenir. Admin istersen
// targetId ile önerinin hedefini ezebilir (P5 "edit" karşılığı).
// reject/ignore: yalnızca durum güncellenir. decidedBy/decidedAt audit izi.
const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "ignore"]),
  targetId: z.uuid("Geçersiz hedef fikir kimliği.").optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ suggestionId: string }> },
) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const { suggestionId } = await params;
    if (!z.uuid().safeParse(suggestionId).success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz öneri kimliği." },
        { status: 400 },
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

    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz karar gövdesi." },
        { status: 400 },
      );
    }
    const { action, targetId } = parsed.data;

    const [suggestion] = await getDb()
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, suggestionId))
      .limit(1);

    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: "Öneri bulunamadı." },
        { status: 404 },
      );
    }
    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Bu öneri için karar zaten verilmiş." },
        { status: 409 },
      );
    }

    if (action !== "approve") {
      const status = action === "reject" ? "rejected" : "ignored";
      await getDb()
        .update(aiSuggestions)
        .set({ status, decidedBy: adminId, decidedAt: new Date() })
        .where(eq(aiSuggestions.id, suggestionId));
      return NextResponse.json({
        success: true,
        data: { id: suggestionId, action },
      });
    }

    const target = targetId ?? suggestion.payload.duplicateOf;
    if (target === suggestion.postId) {
      return NextResponse.json(
        { success: false, error: "Bir fikir kendisiyle birleştirilemez." },
        { status: 400 },
      );
    }

    const outcome = await mergePosts(suggestion.postId, target);

    // Kaynak zaten elle birleştirilmişse öneri güncelliğini yitirmiştir:
    // approved işaretleyip mevcut hedefi bildir (idempotent davranış).
    if (!outcome.ok && outcome.reason !== "source_merged") {
      const messages: Record<string, { error: string; status: number }> = {
        source_not_found: { error: "Kaynak fikir bulunamadı.", status: 404 },
        target_not_found: { error: "Hedef fikir bulunamadı.", status: 404 },
        target_merged: {
          error: "Hedef fikir başka bir fikre birleştirilmiş; zincir oluşmaz.",
          status: 400,
        },
        no_op: { error: "Birleştirme gerçekleşmedi, tekrar deneyin.", status: 409 },
      };
      const failure =
        messages[outcome.reason ?? "no_op"] ?? messages["no_op"]!;
      return NextResponse.json(
        { success: false, error: failure.error },
        { status: failure.status },
      );
    }

    await getDb()
      .update(aiSuggestions)
      .set({ status: "approved", decidedBy: adminId, decidedAt: new Date() })
      .where(eq(aiSuggestions.id, suggestionId));

    return NextResponse.json({
      success: true,
      data: {
        id: suggestionId,
        action: "approve",
        alreadyMerged: outcome.reason === "source_merged",
        mergedIntoId: target,
        movedVotes: outcome.movedVotes ?? 0,
        movedComments: outcome.movedComments ?? 0,
      },
    });
  } catch (err) {
    console.error(
      "POST /api/admin/inbox/[suggestionId] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Karar kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
