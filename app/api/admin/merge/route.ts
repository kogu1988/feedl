import "server-only";

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { postMerges, posts } from "@/lib/db/schema";
import {
  mergeFailureResult,
  mergePosts,
  mergeSchema,
  unmergeSchema,
} from "@/lib/post-merge";

// Drizzle execute sonuç şekli sürücüye göre değişebilir (neon-http satır
// dizisi döndürür); güvenli normalizasyon.
function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

const mergeRefined = mergeSchema;
const unmergeRefined = unmergeSchema;

// POST /api/admin/merge — kaynak fikri hedef fikre birleştir (sadece admin).
// Oylar ve yorumlar hedefe taşınır (zaten hedefe oy veren kullanıcının
// kaynak oyu yerinde kalır — unique(user_id, post_id) ihlal edilmemesi için
// taşınmaz). Tek CTE statement'ı: neon-http interaktif transaction
// desteklemediği için tüm adımlar tek atomik sorguda yürütülür; birleşme
// işaretlenmeden hiçbir satır taşınmaz, tersi de geçerli.
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
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

    const parsed = mergeRefined.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimlikleri." },
        { status: 400 },
      );
    }
    const { sourceId, targetId } = parsed.data;

    const outcome = await mergePosts(sourceId, targetId);

    if (!outcome.ok) {
      const failure = mergeFailureResult(outcome.reason);
      return NextResponse.json(
        { success: false, error: failure.error },
        { status: failure.status },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sourceId,
        targetId,
        movedVotes: outcome.movedVotes,
        movedComments: outcome.movedComments,
      },
    });
  } catch (err) {
    console.error(
      "POST /api/admin/merge failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Birleştirme başarısız. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/merge — birleşmeyi geri al (sadece admin). Taşınan
// oy/yorum satırları merged_from_post_id işaretiyle geri taşınır; audit
// kaydı unmerged_at ile kapatılır. Onaylanmış (approved) duplicate
// önerisi pending'e döner — admin bu kez reddetme/mergi seçeneği için
// Inbox'ta yeniden görür (red/ignore edilmişler geri açılmaz). Tek
// atomik statement.
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
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

    const parsed = unmergeRefined.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
        { status: 400 },
      );
    }
    const { sourceId } = parsed.data;

    const [source] = await getDb()
      .select({ id: posts.id, mergedIntoId: posts.mergedIntoId })
      .from(posts)
      .where(
        and(eq(posts.workspaceId, await getWorkspaceId()), eq(posts.id, sourceId)),
      )
      .limit(1);

    if (!source) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }
    if (!source.mergedIntoId) {
      return NextResponse.json(
        { success: false, error: "Bu fikir birleşmiş durumda değil." },
        { status: 409 },
      );
    }

    const result = await getDb().execute(sql`
      WITH unmergeable AS (
        SELECT 1 FROM posts
        WHERE id = ${sourceId} AND merged_into_id IS NOT NULL
      ),
      restored_votes AS (
        UPDATE votes
        SET post_id = ${sourceId}, merged_from_post_id = NULL
        WHERE merged_from_post_id = ${sourceId}
          AND EXISTS (SELECT 1 FROM unmergeable)
        RETURNING id
      ),
      restored_comments AS (
        UPDATE comments
        SET post_id = ${sourceId}, merged_from_post_id = NULL
        WHERE merged_from_post_id = ${sourceId}
          AND EXISTS (SELECT 1 FROM unmergeable)
        RETURNING id
      ),
      unmerged AS (
        UPDATE posts
        SET merged_into_id = NULL, merged_at = NULL, updated_at = now()
        WHERE id = ${sourceId} AND merged_into_id IS NOT NULL
        RETURNING id
      ),
      marked AS (
        UPDATE ${postMerges}
        SET unmerged_at = now()
        WHERE source_post_id = ${sourceId} AND unmerged_at IS NULL
          AND EXISTS (SELECT 1 FROM unmerged)
        RETURNING id
      ),
      reopened AS (
        UPDATE ai_suggestions
        SET status = 'pending', decided_by = NULL, decided_at = NULL
        WHERE post_id = ${sourceId} AND type = 'duplicate'
          AND status = 'approved'
          AND EXISTS (SELECT 1 FROM unmerged)
        RETURNING id
      )
      SELECT
        (SELECT count(*) FROM restored_votes) AS restored_votes,
        (SELECT count(*) FROM restored_comments) AS restored_comments,
        (SELECT count(*) FROM reopened) AS reopened_suggestions;
    `);

    const unmergeRows = toRows<{
      restored_votes: number;
      restored_comments: number;
      reopened_suggestions: number;
    }>(result);

    if (unmergeRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Geri alma başarısız. Lütfen tekrar deneyin." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sourceId,
        restoredVotes: Number(unmergeRows[0].restored_votes),
        restoredComments: Number(unmergeRows[0].restored_comments),
        reopenedSuggestions: Number(unmergeRows[0].reopened_suggestions),
      },
    });
  } catch (err) {
    console.error(
      "DELETE /api/admin/merge failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Geri alma başarısız. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
