import { NextResponse, type NextRequest } from "next/server";
import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId, resolveWorkspaceIdFromSlug } from "@/lib/db/workspace";
import { postFollowers, posts, votes } from "@/lib/db/schema";
import {
  voteCreatedEventSchema,
  voteDeletedEventSchema,
} from "@/lib/validations/events";
import { voteSchema } from "@/lib/validations/vote";
import { getWidgetSession } from "@/lib/widget/jwt";
import { isOriginAllowed } from "@/lib/widget/origins";
import { requestOrigin } from "@/lib/widget/http";
import { inngest } from "@/inngest/client";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";
import {
  anonymousWidgetUserId,
  ensureWidgetUser,
  getWidgetSubmissionSettings,
} from "@/lib/widget/submission";

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

// Sprint 63z: kimliği oturumdan veya (anonim modda) IP'ten çözer. Tekrarlanan
// kod — POST ve DELETE ortak kullanır.
async function resolveVoteIdentity(req: NextRequest): Promise<{
  userId: string | null;
  workspaceId: string;
} | null> {
  const session = await getWidgetSession();
  const origin = session?.origin ?? requestOrigin(req);
  if (!(await isOriginAllowed(origin))) return null;

  const workspaceId =
    (await resolveWorkspaceIdFromSlug(req.nextUrl.searchParams.get("ws"))) ??
    (await getWorkspaceId());
  const { mode, anonymousVoting } = await getWidgetSubmissionSettings(workspaceId);

  let userId = session?.userId ?? null;
  if (!userId && mode === "anonymous" && anonymousVoting) {
    const ip = clientIpFrom(req);
    userId = anonymousWidgetUserId(ip);
    await ensureWidgetUser({ userId });
  }
  return { userId, workspaceId };
}

export async function POST(req: NextRequest) {
  try {
    const identity = await resolveVoteIdentity(req);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
        { status: 403 },
      );
    }
    const { userId, workspaceId } = identity;
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Oy vermek için uygulamanız üzerinden giriş yapmalısınız.",
        },
        { status: 401 },
      );
    }

    // Sprint 60: widget oy — session kullanıcısı bazlı (anonimde IP kimliği).
    const rl = await enforceRateLimit("widget:votes", userId, { limit: 60 });
    if (!rl.allowed) return rl.response!;

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
      .where(
        and(
          eq(posts.workspaceId, workspaceId),
          eq(posts.id, parsed.data.postId),
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
          error: "Bu fikir başka bir fikirle birleştirildi; oyunu hedef fikirde kullanabilirsin.",
        },
        { status: 400 },
      );
    }

    await getDb()
      .insert(postFollowers)
      .values({ postId: parsed.data.postId, userId })
      .onConflictDoNothing();

    // Sprint 43: widget oyları da webhook matrix'ine dahildir.
    const [inserted] = await getDb()
      .insert(votes)
      .values({ userId, postId: parsed.data.postId })
      .onConflictDoNothing()
      .returning({ id: votes.id });

    if (inserted) {
      try {
        await inngest.send({
          name: "vote/created",
          data: voteCreatedEventSchema.parse({
            postId: parsed.data.postId,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error(
          "POST /api/widget/votes event send failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

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
    const identity = await resolveVoteIdentity(req);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
        { status: 403 },
      );
    }
    const { userId } = identity;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için oturum gerekir." },
        { status: 401 },
      );
    }

    // Sprint 60: widget oy geri alma — session kullanıcısı (anonimde IP) bazlı.
    const rl = await enforceRateLimit("widget:votes", userId, { limit: 60 });
    if (!rl.allowed) return rl.response!;

    const rawPostId = new URL(req.url).searchParams.get("postId") ?? "";
    const parsedPostId = voteSchema.shape.postId.safeParse(rawPostId);
    if (!parsedPostId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(votes)
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.postId, parsedPostId.data),
        ),
      )
      .returning({ id: votes.id });

    // Sprint 43: widget oyu geri alma webhook matrix'ine dahildir.
    if (deleted) {
      try {
        await inngest.send({
          name: "vote/deleted",
          data: voteDeletedEventSchema.parse({
            postId: parsedPostId.data,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error(
          "DELETE /api/widget/votes event send failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

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
