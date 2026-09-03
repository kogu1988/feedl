import { NextRequest, NextResponse } from "next/server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { apiKeys, comments, posts, users, votes } from "@/lib/db/schema";

const sqlCountVotes = sql<number>`(SELECT count(*) FROM ${votes} WHERE ${votes.postId} = ${posts.id})`;
const sqlCountComments = sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.isInternal} = false)`;

// Sprint 34 — Public API: tek fikir detayı + herkese açık yorumlar.
// İç notlar (is_internal=true) her koşulda dışlanır; birleştirilmiş
// fikirler 404 döner (liste ile aynı görünürlük).

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    const rl = checkRateLimit(key.id);
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
    const db = getDb();

    const [post] = await db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        postType: posts.postType,
        sentimentLabel: posts.sentimentLabel,
        aiKeywords: posts.aiKeywords,
        createdAt: posts.createdAt,
        voteCount: sqlCountVotes,
        commentCount: sqlCountComments,
      })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          eq(posts.id, id),
          isNull(posts.mergedIntoId),
        ),
      )
      .limit(1);

    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    const commentRows = await db
      .select({
        id: comments.id,
        body: comments.body,
        authorName: users.name,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(and(eq(comments.postId, id), eq(comments.isInternal, false)))
      .orderBy(asc(comments.createdAt));

    return NextResponse.json({
      success: true,
      data: {
        post: {
          ...post,
          voteCount: Number(post.voteCount),
          commentCount: Number(post.commentCount),
        },
        comments: commentRows,
      },
    });
  } catch (err) {
    console.error("[api/v1/posts/[id]] GET failed:", err);
    return NextResponse.json(
      { success: false, error: "Fikir alınamadı." },
      { status: 500 },
    );
  }
}
