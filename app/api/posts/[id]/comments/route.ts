import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getRole } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { comments, posts } from "@/lib/db/schema";
import { createCommentSchema } from "@/lib/validations/comment";

// POST /api/posts/[id]/comments — fikre yorum yazar (plan.md Sprint 10).
// Rota middleware'da /api/posts(.*) public deseniyle eşleşir; giriş
// zorunluluğu handler içinde kontrol edilir. is_internal yalnızca admin
// oturumuyla dikkate alınır — istemciden gelen bayrağa güvenilmez.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Yorum yapmak için giriş yapmalısınız." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const parsedId = z.uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
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

    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Yorum 2-2000 karakter olmalı." },
        { status: 400 },
      );
    }

    const [post] = await getDb()
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, parsedId.data))
      .limit(1);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    const role = await getRole(userId);
    const isInternal = role === "admin" && parsed.data.isInternal;

    const [created] = await getDb()
      .insert(comments)
      .values({
        postId: parsedId.data,
        userId,
        body: parsed.data.body,
        isInternal,
      })
      .returning({
        id: comments.id,
        isInternal: comments.isInternal,
        createdAt: comments.createdAt,
      });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/posts/[id]/comments failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Yorum kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
