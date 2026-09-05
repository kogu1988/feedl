import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { postFollowers, posts, votes } from "@/lib/db/schema";
import {
  voteCreatedEventSchema,
  voteDeletedEventSchema,
} from "@/lib/validations/events";
import { voteSchema } from "@/lib/validations/vote";
import { inngest } from "@/inngest/client";
import { enforceRateLimit } from "@/lib/rate-limit";

async function countVotes(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(votes)
    .where(eq(votes.postId, postId));
  return row?.value ?? 0;
}

// POST /api/votes — oy ver. Rota middleware'da korumalı; handler'da da
// savunma amaçlı kontrol var. unique(user_id, post_id) sayesinde çifte oy
// insert edilmez; yanıt idempotenttir.
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
      );
    }

    // Sprint 60: oy mutation'ı — kullanıcı bazlı limit.
    const rl = await enforceRateLimit("votes:user", userId, { limit: 60 });
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
          eq(posts.workspaceId, await getWorkspaceId()),
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

    // Sprint 26: oy veren otomatik takipçi olur (Canny modeli).
    await getDb()
      .insert(postFollowers)
      .values({ postId: parsed.data.postId, userId })
      .onConflictDoNothing();

    // Sprint 43: yalnızca gerçekten oy kaydedildiyse yayınla (çift oy değil).
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
          "POST /api/votes event send failed:",
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
      "POST /api/votes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Oy kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/votes?postId=... — oyu geri al.
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
      );
    }

    // Sprint 60: oy geri alma — kullanıcı bazlı limit.
    const rl = await enforceRateLimit("votes:user", userId, { limit: 60 });
    if (!rl.allowed) return rl.response!;

    const rawPostId = new URL(req.url).searchParams.get("postId") ?? "";
    const parsedPostId = z.uuid().safeParse(rawPostId);
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

    const voteCount = await countVotes(parsedPostId.data);

    // Sprint 43: webhook matrix — oy geri alma olayı (best-effort).
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
          "DELETE /api/votes event send failed:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { voted: false, voteCount },
    });
  } catch (err) {
    console.error(
      "DELETE /api/votes failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Oy geri alınamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
