import { NextRequest, NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { apiKeys, comments, postFollowers, posts } from "@/lib/db/schema";
import { commentCreatedEventSchema } from "@/lib/validations/events";
import { withIdempotency } from "@/lib/idempotency";
import { upsertApiUser } from "@/lib/users/api-user";
import { inngest } from "@/inngest/client";

// Sprint 43 (PM raporu §9 madde 6): public API üzerinden yorum yazma.
// Yazar kimliği `user` (email zorunlu) ile müşteri kullanıcısına upsert
// edilir; `write` kapsamı gerektirir. İç not / parent desteklemez — yalnızca
// herkese açık üst düzey yorumlar (Canny'nin public API modeli).

const createCommentSchema = z.object({
  user: z.object({
    email: z.string().trim().email().min(3).max(200),
    name: z.string().trim().max(100).optional(),
  }),
  body: z.string().trim().min(1, "Yorum gerekli.").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    if (!key.scopes.includes("write")) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu işlem write kapsamı olan bir API anahtarı gerektirir.",
        },
        { status: 403 },
      );
    }
    const rl = await checkRateLimit(key.id);
    if (!rl.allowed) {
      return NextResponse.json(API_KEY_ERRORS.rateLimited(rl.retryAfterSec), {
        status: 429,
      });
    }
    try {
      await getDb()
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));
    } catch {
      // yoksay
    }

    const { id } = await params;
    // Sprint 63x: idempotent yürütme — aynı Idempotency-Key ile tekrar eden
    // istek duplike yorum + event oluşturmaz.
    return withIdempotency(req, key, async () => {
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
          { success: false, error: "Geçersiz yorum veya kullanıcı bilgisi." },
          { status: 400 },
        );
      }

      const [post] = await getDb()
        .select({ id: posts.id, mergedIntoId: posts.mergedIntoId })
        .from(posts)
        .where(
          and(
            // Tenant izolasyonu: API anahtarının workspace'i (host değil).
            eq(posts.workspaceId, key.workspaceId),
            eq(posts.id, id),
          ),
        )
        .limit(1);
      if (!post) {
        return NextResponse.json(
          { success: false, error: "Fikir bulunamadı." },
          { status: 404 },
        );
      }
      if (post.mergedIntoId) {
        return NextResponse.json(
          {
            success: false,
            error: "Bu fikir başka bir fikirle birleştirildi; yorumunu hedef fikirde yazabilirsin.",
          },
          { status: 400 },
        );
      }

      const user = await upsertApiUser(parsed.data.user.email, parsed.data.user.name);

      const [created] = await getDb()
        .insert(comments)
        .values({
          postId: post.id,
          userId: user.id,
          body: parsed.data.body,
          isInternal: false,
        })
        .returning({ id: comments.id, createdAt: comments.createdAt });

      await getDb()
        .insert(postFollowers)
        .values({ postId: post.id, userId: user.id })
        .onConflictDoNothing();

      try {
        await inngest.send({
          name: "post/comment.created",
          data: commentCreatedEventSchema.parse({
            commentId: created.id,
            postId: post.id,
            commenterUserId: user.id,
          }),
        });
      } catch (eventErr) {
        console.error(
          "[api/v1/posts/[id]/comments] POST event failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }

      return NextResponse.json(
        { success: true, data: { id: created.id, createdAt: created.createdAt } },
        { status: 201 },
      );
    });
  } catch (err) {
    console.error("[api/v1/posts/[id]/comments] POST failed:", err);
    return NextResponse.json(
      { success: false, error: "Yorum kaydedilemedi." },
      { status: 500 },
    );
  }
}
