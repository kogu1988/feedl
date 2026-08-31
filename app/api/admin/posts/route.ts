import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { postStatusEnum, posts } from "@/lib/db/schema";

const patchSchema = z.object({
  postId: z.uuid("Geçersiz fikir kimliği."),
  status: z.enum(postStatusEnum.enumValues, {
    error: "Geçersiz durum.",
  }),
});

// PATCH /api/admin/posts — fikir durumunu güncelle (sadece admin).
// Rota middleware'da korumalı; admin rolü burada DB'den doğrulanır.
export async function PATCH(req: Request) {
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

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği veya durum." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(posts)
      .set({
        status: parsed.data.status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, parsed.data.postId))
      .returning({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        updatedAt: posts.updatedAt,
      });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Durum güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
