import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { postMerges } from "@/lib/db/schema";

// neon-http üzerindeki drizzle execute() sonucu sürüme göre ya satır dizisi
// ya da { rows } zarfı döndürebilir; ikisini de normalize et.
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

export interface MergeOutcome {
  ok: boolean;
  reason?:
    | "source_not_found"
    | "target_not_found"
    | "source_merged"
    | "target_merged"
    | "no_op";
  movedVotes?: number;
  movedComments?: number;
}

// Merge isteği doğrulama şeması (Sprint 63x: route'taki saf mantığı buraya
// çıkarıldı — test edilebilir). sourceId !== targetId refine'ı çapraz merge
// kendine birleştirmeyi engeller.
export const mergeSchema = z
  .object({
    sourceId: z.uuid("Geçersiz kaynak fikir kimliği."),
    targetId: z.uuid("Geçersiz hedef fikir kimliği."),
  })
  .refine((data) => data.sourceId !== data.targetId, {
    error: "Bir fikir kendisiyle birleştirilemez.",
  });

export const unmergeSchema = z.object({
  sourceId: z.uuid("Geçersiz fikir kimliği."),
});

// Başarısız merge reason'ı → HTTP yanıtı eşlemesi (Sprint 63x: saf, test
// edilebilir). Route bu tabloyu kullanır — hata durumu/status tek kaynak.
export function mergeFailureResult(
  reason: MergeOutcome["reason"] | undefined,
): { error: string; status: number } {
  const map: Record<string, { error: string; status: number }> = {
    source_not_found: { error: "Kaynak fikir bulunamadı.", status: 404 },
    target_not_found: { error: "Hedef fikir bulunamadı.", status: 404 },
    source_merged: {
      error: "Kaynak fikir zaten birleştirilmiş.",
      status: 409,
    },
    target_merged: {
      error: "Hedef fikir başka bir fikre birleştirilmiş; zincir oluşmaz.",
      status: 400,
    },
    no_op: { error: "Fikir zaten birleştirilmiş.", status: 409 },
  };
  return map[reason ?? "no_op"] ?? map["no_op"];
}

// Sprint 20'den taşındı (Sprint 33: Autopilot Inbox approve'u da kullanır).
// Kaynak fikri hedef fikre birleştirir: oylar ve yorumlar hedefe taşınır
// (zaten hedefe oy veren kullanıcının kaynak oyu yerinde kalır —
// unique(user_id, post_id) ihlal edilmemesi için taşınmaz). Tek CTE
// statement'ı: neon-http interaktif transaction desteklemediği için tüm
// adımlar tek atomik sorguda yürütülür; birleşme işaretlenmeden hiçbir
// satır taşınmaz, tersi de geçerli.
export async function mergePosts(
  sourceId: string,
  targetId: string,
): Promise<MergeOutcome> {
  // Her iki fikrin mevcudiyeti ve birleşme durumu önceden kontrol edilir;
  // scope aynı workspace ile sınırlıdır (çapraz workspace merge yok).
  const state = await getDb().execute(sql`
    SELECT id, merged_into_id FROM posts
    WHERE workspace_id = ${await getWorkspaceId()}
      AND id IN (${sourceId}, ${targetId})
  `);

  const found = toRows<{ id: string; merged_into_id: string | null }>(state);
  const source = found.find((row) => row.id === sourceId);
  const target = found.find((row) => row.id === targetId);

  if (!source) return { ok: false, reason: "source_not_found" };
  if (!target) return { ok: false, reason: "target_not_found" };
  if (source.merged_into_id) return { ok: false, reason: "source_merged" };
  if (target.merged_into_id) return { ok: false, reason: "target_merged" };

  const result = await getDb().execute(sql`
    WITH moved_votes AS (
      UPDATE votes
      SET post_id = ${targetId}, merged_from_post_id = ${sourceId}
      WHERE post_id = ${sourceId}
        AND user_id NOT IN (
          SELECT user_id FROM votes WHERE post_id = ${targetId}
        )
      RETURNING id
    ),
    moved_comments AS (
      UPDATE comments
      SET post_id = ${targetId}, merged_from_post_id = ${sourceId}
      WHERE post_id = ${sourceId}
      RETURNING id
    ),
    merged AS (
      UPDATE posts
      SET merged_into_id = ${targetId}, merged_at = now(), updated_at = now()
      WHERE id = ${sourceId} AND merged_into_id IS NULL
      RETURNING id
    )
    INSERT INTO ${postMerges} (
      source_post_id, target_post_id, moved_vote_ids, moved_comment_ids
    )
    SELECT ${sourceId}, ${targetId},
      COALESCE((SELECT json_agg(id) FROM moved_votes), '[]'::json),
      COALESCE((SELECT json_agg(id) FROM moved_comments), '[]'::json)
    WHERE EXISTS (SELECT 1 FROM merged)
    RETURNING moved_vote_ids, moved_comment_ids;
  `);

  const mergeRows = toRows<{
    moved_vote_ids: string[];
    moved_comment_ids: string[];
  }>(result);

  // WHERE EXISTS (merged) satır üretmediyse birleşme gerçekleşmedi (yarış).
  if (mergeRows.length === 0) {
    return { ok: false, reason: "no_op" };
  }

  return {
    ok: true,
    movedVotes: mergeRows[0].moved_vote_ids.length,
    movedComments: mergeRows[0].moved_comment_ids.length,
  };
}
