import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRole } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { comments, postFollowers, posts } from "@/lib/db/schema";
import { createCommentSchema } from "@/lib/validations/comment";
import { commentCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

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
      .select({ id: posts.id, mergedIntoId: posts.mergedIntoId })
      .from(posts)
      .where(
        and(eq(posts.workspaceId, await getWorkspaceId()), eq(posts.id, parsedId.data)),
      )
      .limit(1);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }
    // Sprint 20: birleşmiş fikre yorum kabul edilmez — tartışma hedef fikirde.
    if (post.mergedIntoId) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu fikir başka bir fikirle birleştirildi; yorumunu hedef fikirde yazabilirsin.",
        },
        { status: 400 },
      );
    }

    const role = await getRole(userId);
    const isInternal = role === "admin" && parsed.data.isInternal;

    // Sprint 24: yanıt hedefi doğrulaması — parent aynı fikirde olmalı ve
    // TEK SEVİYE thread (parent'ın da parentId'si olamaz).
    if (parsed.data.parentId) {
      const [parent] = await getDb()
        .select({
          id: comments.id,
          postId: comments.postId,
          parentId: comments.parentId,
          userId: comments.userId,
        })
        .from(comments)
        .where(eq(comments.id, parsed.data.parentId))
        .limit(1);
      if (!parent || parent.postId !== parsedId.data) {
        return NextResponse.json(
          { success: false, error: "Yanıtlanacak yorum bulunamadı." },
          { status: 400 },
        );
      }
      if (parent.parentId) {
        return NextResponse.json(
          {
            success: false,
            error: "Yanıtlar yalnızca bir seviye derinlikte olabilir.",
          },
          { status: 400 },
        );
      }
    }

    const [created] = await getDb()
      .insert(comments)
      .values({
        postId: parsedId.data,
        userId,
        body: parsed.data.body,
        isInternal,
        ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
      })
      .returning({
        id: comments.id,
        isInternal: comments.isInternal,
        createdAt: comments.createdAt,
      });

    // Sprint 26: yorum yazan otomatik takipçi olur (bildirim zinciri için).
    await getDb()
      .insert(postFollowers)
      .values({ postId: parsedId.data, userId })
      .onConflictDoNothing();

    // Sprint 24: iç notlar için bildirim gönderilmez; normal yorumlarda
    // yazar + yanıtlanan kişiye haber ver. Event gönderimi başarısız olsa
    // bile yorum kaydedilmiş kalır.
    if (!isInternal) {
      const eventPayload = commentCreatedEventSchema.safeParse({
        commentId: created.id,
        postId: parsedId.data,
        commenterUserId: userId,
      });
      if (eventPayload.success) {
        try {
          await inngest.send({
            name: "post/comment.created",
            data: eventPayload.data,
          });
        } catch (eventErr) {
          console.error(
            "post/comment.created event could not be sent:",
            eventErr instanceof Error ? eventErr.message : eventErr,
          );
        }
      }
    }

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
