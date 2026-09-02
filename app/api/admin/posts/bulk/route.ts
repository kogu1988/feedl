import "server-only";

import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import {
  comments,
  postStatusEnum,
  postStatusHistory,
  postTags,
  posts,
  tags as tagsTable,
} from "@/lib/db/schema";
import { statusLabels } from "@/lib/post-format";
import { postStatusChangedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 22: toplu işlemler — çoklu fikir seçilip tek istekte status
// değiştirme ve/veya etiket ekleme. Her aksiyon opsiyonel; en az biri
// zorunlu. Status değişen fikirler için post/status.changed event'leri
// tek tek fırlatılır (notify-shipped zinciri bireysel akışla aynı).

const bulkSchema = z
  .object({
    postIds: z.array(z.uuid()).min(1, "En az bir fikir seçilmeli.").max(100),
    status: z
      .enum(postStatusEnum.enumValues, { error: "Geçersiz durum." })
      .optional(),
    addTagId: z.uuid("Geçersiz etiket.").optional(),
    // Sprint 23: status değişiminde opsiyonel açıklama — geçmişe yazılır ve
    // bildirim e-postasında gösterilir.
    note: z.string().max(500, "Açıklama en fazla 500 karakter.").optional(),
  })
  .refine((data) => data.status !== undefined || data.addTagId !== undefined, {
    error: "Uygulanacak işlem yok.",
  });

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

    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz toplu işlem isteği." },
        { status: 400 },
      );
    }
    const { postIds, status, addTagId } = parsed.data;
    const note = parsed.data.note?.trim() || undefined;

    let statusChanged = 0;
    if (status !== undefined) {
      // Sadece durumu gerçekten değişenleri güncelle; event'i onlar için
      // fırlat (notify-shipped yalnızca shipped'e geçenlere mail atar).
      const existing = await getDb()
        .select({ id: posts.id, status: posts.status })
        .from(posts)
        .where(inArray(posts.id, postIds));

      const toChange = existing.filter((row) => row.status !== status);
      if (toChange.length > 0) {
        const changingIds = toChange.map((row) => row.id);
        await getDb()
          .update(posts)
          .set({ status, updatedAt: new Date() })
          .where(inArray(posts.id, changingIds));
        statusChanged = changingIds.length;

        for (const row of toChange) {
          const payload = postStatusChangedEventSchema.safeParse({
            postId: row.id,
            oldStatus: row.status,
            newStatus: status,
            ...(note ? { note } : {}),
          });
          if (!payload.success) {
            continue;
          }
          try {
            await inngest.send({
              name: "post/status.changed",
              data: payload.data,
            });
          } catch (eventErr) {
            console.error(
              "post/status.changed event could not be sent:",
              eventErr instanceof Error ? eventErr.message : eventErr,
            );
          }
        }

        // Sprint 23: toplu değişim de geçmişe yazılır (best-effort).
        try {
          await getDb().insert(postStatusHistory).values(
            toChange.map((row) => ({
              postId: row.id,
              oldStatus: row.status,
              newStatus: status,
              note: note ?? null,
              createdBy: adminId,
            })),
          );
        } catch (historyErr) {
          console.error(
            "bulk status history could not be saved:",
            historyErr instanceof Error ? historyErr.message : historyErr,
          );
        }

        // Toplu iç not: tek tek kaydetmek yerine özet not her fikre düşer
        // (best-effort — hata akışı bozmaz).
        try {
          const oldLabelSet = [
            ...new Set(
              toChange.map((row) => statusLabels[row.status] ?? row.status),
            ),
          ];
          await getDb().insert(comments).values(
            changingIds.map((postId) => ({
              postId,
              userId: adminId,
              body: `Toplu durum güncellendi: ${oldLabelSet.join(", ")} → ${statusLabels[status] ?? status}`,
              isInternal: true,
            })),
          );
        } catch (noteErr) {
          console.error(
            "bulk status internal notes could not be saved:",
            noteErr instanceof Error ? noteErr.message : noteErr,
          );
        }
      }
    }

    let tagsLinked = 0;
    if (addTagId !== undefined) {
      const [tag] = await getDb()
        .select({ id: tagsTable.id })
        .from(tagsTable)
        .where(eq(tagsTable.id, addTagId))
        .limit(1);
      if (!tag) {
        return NextResponse.json(
          { success: false, error: "Etiket bulunamadı." },
          { status: 404 },
        );
      }
      const inserted = await getDb()
        .insert(postTags)
        .values(postIds.map((postId) => ({ postId, tagId: tag.id })))
        .onConflictDoNothing()
        .returning({ id: postTags.id });
      tagsLinked = inserted.length;
    }

    return NextResponse.json({
      success: true,
      data: { total: postIds.length, statusChanged, tagsLinked },
    });
  } catch (err) {
    console.error(
      "POST /api/admin/posts/bulk failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        success: false,
        error: "Toplu işlem başarısız. Lütfen tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
