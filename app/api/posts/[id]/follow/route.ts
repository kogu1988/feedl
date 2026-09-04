import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { postFollowers, posts } from "@/lib/db/schema";

// POST /api/posts/[id]/follow — fikri takip et (Sprint 40). Rota
// middleware'da /api/posts(.*) public deseniyle eşleşir; giriş zorunluluğu
// handler içinde kontrol edilir. unique(post_id, user_id) sayesinde insert
// idempotenttir.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Takip etmek için giriş yapmalısınız." },
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

    const [post] = await getDb()
      .select({ id: posts.id, mergedIntoId: posts.mergedIntoId })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          eq(posts.id, parsedId.data),
        ),
      )
      .limit(1);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }
    // Birleşmiş fikir takip edilemez — bildirim akışı hedef fikirde.
    if (post.mergedIntoId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bu fikir başka bir fikirle birleştirildi; takibi hedef fikirde yapabilirsin.",
        },
        { status: 400 },
      );
    }

    await getDb()
      .insert(postFollowers)
      .values({ postId: parsedId.data, userId })
      .onConflictDoNothing();

    return NextResponse.json({ success: true, data: { following: true } });
  } catch (err) {
    console.error(
      "POST /api/posts/[id]/follow failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Takip kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/posts/[id]/follow — takibi bırak. Oy ve yorumlar korunur.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için giriş yapmalısınız." },
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

    await getDb()
      .delete(postFollowers)
      .where(
        and(
          eq(postFollowers.postId, parsedId.data),
          eq(postFollowers.userId, userId),
        ),
      );

    return NextResponse.json({ success: true, data: { following: false } });
  } catch (err) {
    console.error(
      "DELETE /api/posts/[id]/follow failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Takip kaldırılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
