import "server-only";

import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import {
  comments,
  postStatusEnum,
  postStatusHistory,
  postTypeEnum,
  posts,
  users,
  votes,
} from "@/lib/db/schema";
import { statusLabels, typeLabels } from "@/lib/post-format";
import { postStatusChangedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 21: status veya postType en az biri gönderilmeli — ikisi de
// opsiyonel, tek istekte birlikte de gönderilebilir.
const patchSchema = z
  .object({
    postId: z.uuid("Geçersiz fikir kimliği."),
    status: z
      .enum(postStatusEnum.enumValues, { error: "Geçersiz durum." })
      .optional(),
    postType: z
      .enum(postTypeEnum.enumValues, { error: "Geçersiz tür." })
      .optional(),
    // Sprint 25a: status değişiminde opsiyonel açıklama — post_status_history
    //'ye yazılır ve bildirim e-postasında gösterilir.
    note: z.string().max(500, "Açıklama en fazla 500 karakter.").optional(),
    // Sprint 28: iç roadmap alanları — her biri opsiyonel. ownerId Clerk
    // kullanıcı kimliğidir (user_... formatı — UUID DEĞİL, z.uuid() kullanma!).
    ownerId: z.string().min(1, "Geçersiz sahip.").nullable().optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih (YYYY-AA-GG).")
      .nullable()
      .optional(),
    impact: z.number().int().min(1).max(3).nullable().optional(),
    effort: z.number().int().min(1).max(3).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.postType !== undefined, {
    error: "Güncellenecek alan yok.",
  });

// GET /api/admin/posts?q=...&exclude=... — merge hedef seçici için başlık
// araması (Sprint 20). Birleşmiş fikirler hedef olamaz; kaynak fikir de
// listeden çıkarılır. Sonuç sınırlı: sadece id/başlık/oy.
export async function GET(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const excludeRaw = url.searchParams.get("exclude") ?? "";
    const excludeId = z.uuid().safeParse(excludeRaw).success
      ? excludeRaw
      : null;

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rows = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        voteCount: count(votes.id),
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(
        and(
          isNull(posts.mergedIntoId),
          excludeId ? ne(posts.id, excludeId) : undefined,
          ilike(posts.title, `%${q}%`),
        ),
      )
      .groupBy(posts.id)
      .orderBy(desc(posts.createdAt))
      .limit(8);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Arama başarısız. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/posts — fikir durumunu güncelle (sadece admin).
// Rota middleware'da korumalı; admin rolü burada DB'den doğrulanır.
export async function PATCH(req: Request) {
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

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği veya durum." },
        { status: 400 },
      );
    }

    // Eski durum/tür, event payload'ı ve iç not için güncellemeden önce
    // okunur.
    const [existing] = await getDb()
      .select({
        id: posts.id,
        status: posts.status,
        postType: posts.postType,
      })
      .from(posts)
      .where(eq(posts.id, parsed.data.postId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    // Sprint 28: owner atanıyorsa kullanıcının varlığını doğrula (FK hatası
    // yerine anlaşılır 400).
    if (parsed.data.ownerId) {
      const [owner] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, parsed.data.ownerId))
        .limit(1);
      if (!owner) {
        return NextResponse.json(
          { success: false, error: "Sahip olarak atanacak kullanıcı bulunamadı." },
          { status: 400 },
        );
      }
    }

    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existing.status;
    const typeChanged =
      parsed.data.postType !== undefined &&
      parsed.data.postType !== existing.postType;

    const [updated] = await getDb()
      .update(posts)
      .set({
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
        ...(parsed.data.postType !== undefined
          ? { postType: parsed.data.postType }
          : {}),
        // Sprint 28: iç roadmap alanları — null açıkça "temizle" demektir.
        ...(parsed.data.ownerId !== undefined
          ? { ownerId: parsed.data.ownerId }
          : {}),
        ...(parsed.data.targetDate !== undefined
          ? { targetDate: parsed.data.targetDate } // date kolonu: YYYY-AA-GG string
          : {}),
        ...(parsed.data.impact !== undefined
          ? { impact: parsed.data.impact }
          : {}),
        ...(parsed.data.effort !== undefined
          ? { effort: parsed.data.effort }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, parsed.data.postId))
      .returning({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        postType: posts.postType,
        updatedAt: posts.updatedAt,
      });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    // Durum gerçekten değiştiyse Inngest event'i fırlat (plan.md Sprint 6);
    // "shipped"e geçişte yazar + oy verenlere bildirim gider. Event gönderimi
    // başarısız olsa bile durum güncellemesi başarılı kalmalıdır.
    const newStatus = updated.status;
    const note = parsed.data.note?.trim() || undefined;
    const payload = postStatusChangedEventSchema.safeParse({
      postId: updated.id,
      oldStatus: existing.status,
      newStatus,
      ...(note ? { note } : {}),
    });
    if (payload.success && statusChanged) {
      try {
        await inngest.send({ name: "post/status.changed", data: payload.data });
      } catch (eventErr) {
        console.error(
          "post/status.changed event could not be sent:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

    // Sprint 23: status değişimi post_status_history'ye yazılır (best-effort).
    if (statusChanged) {
      try {
        await getDb().insert(postStatusHistory).values({
          postId: updated.id,
          oldStatus: existing.status,
          newStatus: updated.status,
          note: note ?? null,
          createdBy: adminId,
        });
      } catch (historyErr) {
        console.error(
          "post status history could not be saved:",
          historyErr instanceof Error ? historyErr.message : historyErr,
        );
      }
    }

    // Durum/tür değişince detay sayfasına otomatik iç not düş (plan.md
    // Sprint 10 eki; Canny davranışı: değişiklikler iz bırakır). Best-effort:
    // not başarısız olsa bile güncelleme başarılı kalmalıdır.
    if (statusChanged || typeChanged) {
      try {
        const notes: string[] = [];
        if (statusChanged) {
          const oldLabel = statusLabels[existing.status] ?? existing.status;
          const newLabel = statusLabels[updated.status] ?? updated.status;
          notes.push(`Durum güncellendi: ${oldLabel} → ${newLabel}`);
        }
        if (typeChanged) {
          const oldType = existing.postType
            ? (typeLabels[existing.postType] ?? existing.postType)
            : "—";
          const newType = updated.postType
            ? (typeLabels[updated.postType] ?? updated.postType)
            : "—";
          notes.push(`Tür güncellendi: ${oldType} → ${newType}`);
        }
        await getDb().insert(comments).values({
          postId: updated.id,
          userId: adminId,
          body: notes.join("\n"),
          isInternal: true,
        });
      } catch (noteErr) {
        console.error(
          "status change internal note could not be saved:",
          noteErr instanceof Error ? noteErr.message : noteErr,
        );
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Durum güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
