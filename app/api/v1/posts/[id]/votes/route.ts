import { NextRequest, NextResponse } from "next/server";

import { and, count, eq } from "drizzle-orm";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { apiKeys, postFollowers, posts, votes } from "@/lib/db/schema";
import {
  voteCreatedEventSchema,
  voteDeletedEventSchema,
} from "@/lib/validations/events";
import { upsertApiUser } from "@/lib/users/api-user";
import { inngest } from "@/inngest/client";

// Sprint 43 (PM raporu §9 madde 6): public API üzerinden oy verme/geri alma.
// API anahtarı workspace-scoped; yazar kimliği `user` (email zorunlu) ile
// müşteri kullanıcısına upsert edilir. `write` kapsamı gerektirir.

async function countVotes(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(votes)
    .where(eq(votes.postId, postId));
  return row?.value ?? 0;
}

async function loadPublicPost(postId: string) {
  const [post] = await getDb()
    .select({ id: posts.id, mergedIntoId: posts.mergedIntoId })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, await getWorkspaceId()),
        eq(posts.id, postId),
      ),
    )
    .limit(1);
  return post ?? null;
}

function requireWriteScope(key: { scopes: string[] }): NextResponse | null {
  return key.scopes.includes("write")
    ? null
    : NextResponse.json(
        {
          success: false,
          error: "Bu işlem write kapsamı olan bir API anahtarı gerektirir.",
        },
        { status: 403 },
      );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    const scopeError = requireWriteScope(key);
    if (scopeError) return scopeError;
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
    let body: { user?: { email?: string; name?: string } };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
    const email = body?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Bir yazar e-postası (user.email) gerekli." },
        { status: 400 },
      );
    }

    const post = await loadPublicPost(id);
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
          error: "Bu fikir başka bir fikirle birleştirildi; oyunu hedef fikirde kullanabilirsin.",
        },
        { status: 400 },
      );
    }

    const user = await upsertApiUser(email, body?.user?.name);
    const [inserted] = await getDb()
      .insert(votes)
      .values({ userId: user.id, postId: post.id })
      .onConflictDoNothing()
      .returning({ id: votes.id });

    await getDb()
      .insert(postFollowers)
      .values({ postId: post.id, userId: user.id })
      .onConflictDoNothing();

    if (inserted) {
      try {
        await inngest.send({
          name: "vote/created",
          data: voteCreatedEventSchema.parse({ postId: post.id, userId: user.id }),
        });
      } catch (eventErr) {
        console.error(
          "[api/v1/posts/[id]/votes] POST event failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

    const voteCount = await countVotes(post.id);
    return NextResponse.json({ success: true, data: { voted: true, voteCount } });
  } catch (err) {
    console.error("[api/v1/posts/[id]/votes] POST failed:", err);
    return NextResponse.json(
      { success: false, error: "Oy kaydedilemedi." },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/posts/[id]/votes?email=... — oyu geri al.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    const scopeError = requireWriteScope(key);
    if (scopeError) return scopeError;
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
    const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Bir yazar e-postası (email) gerekli." },
        { status: 400 },
      );
    }

    const post = await loadPublicPost(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    const user = await upsertApiUser(email);
    const [deleted] = await getDb()
      .delete(votes)
      .where(and(eq(votes.userId, user.id), eq(votes.postId, post.id)))
      .returning({ id: votes.id });

    const voteCount = await countVotes(post.id);

    if (deleted) {
      try {
        await inngest.send({
          name: "vote/deleted",
          data: voteDeletedEventSchema.parse({ postId: post.id, userId: user.id }),
        });
      } catch (eventErr) {
        console.error(
          "[api/v1/posts/[id]/votes] DELETE event failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

    return NextResponse.json({ success: true, data: { voted: false, voteCount } });
  } catch (err) {
    console.error("[api/v1/posts/[id]/votes] DELETE failed:", err);
    return NextResponse.json(
      { success: false, error: "Oy geri alınamadı." },
      { status: 500 },
    );
  }
}
