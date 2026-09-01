import "server-only";

import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { comments, postStatusEnum, posts, votes } from "@/lib/db/schema";
import { statusLabels } from "@/lib/post-format";
import { postStatusChangedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

const patchSchema = z.object({
  postId: z.uuid("Geçersiz fikir kimliği."),
  status: z.enum(postStatusEnum.enumValues, {
    error: "Geçersiz durum.",
  }),
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

    // Eski durum, event payload'ı için güncellemeden önce okunur.
    const [existing] = await getDb()
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(eq(posts.id, parsed.data.postId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    const [updated] = await getDb()
      .update(posts)
      .set({
        status: parsed.data.status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, parsed.data.postId))
      .returning({
        id: posts.id,
        title: posts.title,
        status: posts.status,
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
    const payload = postStatusChangedEventSchema.safeParse({
      postId: updated.id,
      oldStatus: existing.status,
      newStatus: updated.status,
    });
    if (payload.success && existing.status !== updated.status) {
      try {
        await inngest.send({ name: "post/status.changed", data: payload.data });
      } catch (eventErr) {
        console.error(
          "post/status.changed event could not be sent:",
          eventErr instanceof Error ? eventErr.message : eventErr,
        );
      }
    }

    // Durum değişince detay sayfasına otomatik iç not düş (plan.md Sprint 10
    // eki; Canny davranışı: durum değişiklikleri iz bırakır). Best-effort:
    // not başarısız olsa bile durum güncellemesi başarılı kalmalıdır.
    if (existing.status !== updated.status) {
      try {
        const oldLabel = statusLabels[existing.status] ?? existing.status;
        const newLabel = statusLabels[updated.status] ?? updated.status;
        await getDb().insert(comments).values({
          postId: updated.id,
          userId: adminId,
          body: `Durum güncellendi: ${oldLabel} → ${newLabel}`,
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
