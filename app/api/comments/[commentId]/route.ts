import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getRole } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { commentDeletedEventSchema } from "@/lib/validations/events";
import { editCommentSchema } from "@/lib/validations/comment";
import { inngest } from "@/inngest/client";

// Sprint 24: yorum düzenleme ve silme. Kendi yorumunu herkes yönetir;
// admin her yorumu yönetebilir (Canny moderasyon modeli). İç notlar zaten
// yalnızca admin tarafından oluşturulur ve görülür. Parent silinirse
// yanıtlar cascade ile gider (schema onDelete).

async function loadComment(commentId: string) {
  const parsedId = z.uuid().safeParse(commentId);
  if (!parsedId.success) {
    return null;
  }
  const [comment] = await getDb()
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      isInternal: comments.isInternal,
    })
    .from(comments)
    .where(eq(comments.id, parsedId.data))
    .limit(1);
  return comment ?? null;
}

// PATCH /api/comments/[commentId] — yalnızca gövde düzenlenir. Yazar veya
// admin; editedAt işaretlenir (UI "düzenlendi" gösterir).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Giriş yapmalısınız." },
        { status: 401 },
      );
    }

    const { commentId } = await params;
    const comment = await loadComment(commentId);
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Yorum bulunamadı." },
        { status: 404 },
      );
    }

    const role = await getRole(userId);
    const isOwner = comment.userId === userId;
    if (!isOwner && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Bu yorumu düzenleme yetkiniz yok." },
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

    const parsed = editCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Yorum 2-2000 karakter olmalı." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(comments)
      .set({ body: parsed.data.body, editedAt: new Date() })
      .where(eq(comments.id, comment.id))
      .returning({
        id: comments.id,
        body: comments.body,
        editedAt: comments.editedAt,
      });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/comments/[commentId] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Yorum güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/comments/[commentId] — yazar veya admin. Parent silinirse
// yanıtlar cascade ile gider (schema onDelete).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Giriş yapmalısınız." },
        { status: 401 },
      );
    }

    const { commentId } = await params;
    const comment = await loadComment(commentId);
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Yorum bulunamadı." },
        { status: 404 },
      );
    }

    const role = await getRole(userId);
    const isOwner = comment.userId === userId;
    if (!isOwner && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Bu yorumu silme yetkiniz yok." },
        { status: 403 },
      );
    }

    await getDb().delete(comments).where(eq(comments.id, comment.id));

    // Sprint 43: webhook matrix — yorum silme olayı (best-effort).
    try {
      await inngest.send({
        name: "post/comment.deleted",
        data: commentDeletedEventSchema.parse({
          commentId: comment.id,
          postId: comment.postId,
          deletedById: userId,
        }),
      });
    } catch (eventErr) {
      console.error(
        "DELETE /api/comments/[commentId] event send failed:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      "DELETE /api/comments/[commentId] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Yorum silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
