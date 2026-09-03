import { NextResponse, type NextRequest } from "next/server";
import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { postFollowers, posts, votes } from "@/lib/db/schema";
import { voteSchema } from "@/lib/validations/vote";
import { getWidgetSession, isOriginAllowed } from "@/lib/widget/jwt";
import { requestOrigin } from "@/lib/widget/http";

async function countVotes(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(votes)
    .where(eq(votes.postId, postId));
  return row?.value ?? 0;
}

// Widget oyları (plan.md Sprint 32): kimlik çerezden çözülür (Clerk değil);
// kalan kurallar portal /api/votes ile aynıdır (unique(user_id, post_id)
// idempotency + birleşmiş fikre oy reddi + otomatik takipçi).

export async function POST(req: NextRequest) {
  try {
    const session = await getWidgetSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Oy vermek için uygulamanız üzerinden giriş yapmalısınız.",
        },
        { status: 401 },
      );
    }

    const origin = session.origin ?? requestOrigin(req);
    if (!isOriginAllowed(origin)) {
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
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

    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
        { status: 400 },
      );
    }

    // Sprint 20: birleşmiş fikre oy kabul edilmez — oy hedef fikirde.
    const [post] = await getDb()
      .select({ mergedIntoId: posts.mergedIntoId })
      .from(posts)
      .where(eq(posts.id, parsed.data.postId))
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
          error: "Bu fikir başka bir fikirle birleştirildi; oyunu hedef fikirde kullanabilirsin.",
        },
        { status: 400 },
      );
    }

    await getDb()
      .insert(votes)
      .values({ userId: session.userId, postId: parsed.data.postId })
      .onConflictDoNothing();

    await getDb()
      .insert(postFollowers)
      .values({ postId: parsed.data.postId, userId: session.userId })
      .onConflictDoNothing();

    const voteCount = await countVotes(parsed.data.postId);
    return NextResponse.json({
      success: true,
      data: { voted: true, voteCount },
    });
  } catch (err) {
    console.error(
      "POST /api/widget/votes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Oy kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/widget/votes?postId=... — oyu geri al.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getWidgetSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için oturum gerekir." },
        { status: 401 },
      );
    }

    const rawPostId = new URL(req.url).searchParams.get("postId") ?? "";
    const parsedPostId = voteSchema.shape.postId.safeParse(rawPostId);
    if (!parsedPostId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
        { status: 400 },
      );
    }

    await getDb()
      .delete(votes)
      .where(
        and(
          eq(votes.userId, session.userId),
          eq(votes.postId, parsedPostId.data),
        ),
      );

    const voteCount = await countVotes(parsedPostId.data);
    return NextResponse.json({
      success: true,
      data: { voted: false, voteCount },
    });
  } catch (err) {
    console.error(
      "DELETE /api/widget/votes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Oy geri alınamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
