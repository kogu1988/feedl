import "server-only";

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { postMerges, posts } from "@/lib/db/schema";
import { mergePosts } from "@/lib/post-merge";

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

const mergeSchema = z
  .object({
    sourceId: z.uuid("Geçersiz kaynak fikir kimliği."),
    targetId: z.uuid("Geçersiz hedef fikir kimliği."),
  })
  .refine((data) => data.sourceId !== data.targetId, {
    error: "Bir fikir kendisiyle birleştirilemez.",
  });

const unmergeSchema = z.object({
  sourceId: z.uuid("Geçersiz fikir kimliği."),
});

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

    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimlikleri." },
        { status: 400 },
      );
    }
    const { sourceId, targetId } = parsed.data;

    const outcome = await mergePosts(sourceId, targetId);

    if (!outcome.ok) {
      const messages: Record<string, { error: string; status: number }> = {
        source_not_found: {
          error: "Kaynak fikir bulunamadı.",
          status: 404,
        },
        target_not_found: {
          error: "Hedef fikir bulunamadı.",
          status: 404,
        },
        source_merged: {
          error: "Kaynak fikir zaten birleştirilmiş.",
          status: 409,
        },
        target_merged: {
          error:
            "Hedef fikir başka bir fikre birleştirilmiş; zincir oluşmaz.",
          status: 400,
        },
        no_op: {
          error: "Fikir zaten birleştirilmiş.",
          status: 409,
        },
      };
      const failure =
        messages[outcome.reason ?? "no_op"] ?? messages["no_op"];
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
// kaydı unmerged_at ile kapatılır. Tek atomik statement.
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

    const parsed = unmergeSchema.safeParse(body);
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
      .where(eq(posts.id, sourceId))
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
      )
      SELECT
        (SELECT count(*) FROM restored_votes) AS restored_votes,
        (SELECT count(*) FROM restored_comments) AS restored_comments;
    `);

    const unmergeRows = toRows<{
      restored_votes: number;
      restored_comments: number;
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
