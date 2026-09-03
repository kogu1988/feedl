import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { postOpportunities } from "@/lib/db/schema";

// Sprint 31 — fikir ↔ fırsat bağlama (P3.2). Bağ, gelir skorunu besler;
// fikir veya fırsat silinince cascade kaldırılır. Unique constraint
// sayesinde çift bağlama idempotenttir.

const linkInputSchema = z.object({
  postId: z.string().uuid(),
  opportunityId: z.string().uuid(),
});

// POST /api/admin/opportunities/links — fikri fırsata bağla.
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
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

    const parsed = linkInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir veya fırsat kimliği." },
        { status: 400 },
      );
    }

    await getDb()
      .insert(postOpportunities)
      .values({
        postId: parsed.data.postId,
        opportunityId: parsed.data.opportunityId,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/admin/opportunities/links failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fırsat bağlanamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/opportunities/links?postId=...&opportunityId=... — bağı kaldır.
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const params = new URL(req.url).searchParams;
    const parsed = linkInputSchema.safeParse({
      postId: params.get("postId") ?? "",
      opportunityId: params.get("opportunityId") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir veya fırsat kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(postOpportunities)
      .where(
        and(
          eq(postOpportunities.postId, parsed.data.postId),
          eq(postOpportunities.opportunityId, parsed.data.opportunityId),
        ),
      )
      .returning({ id: postOpportunities.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Bağlantı bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/opportunities/links failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Bağlantı kaldırılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
