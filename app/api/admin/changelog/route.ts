import "server-only";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { changelogEntries, changelogPostLinks } from "@/lib/db/schema";

// Sprint 25: bağımsız changelog yönetimi (admin). GET: liste (son 50),
// POST: yeni duyuru (başlık + gövde + opsiyonel label + opsiyonel post
// linkleri), DELETE: ?id= ile sil.

const createSchema = z.object({
  title: z.string().trim().min(3, "Başlık en az 3 karakter.").max(120),
  body: z.string().trim().min(3, "Gövde en az 3 karakter.").max(5000),
  label: z
    .enum(["yeni", "iyileştirme", "düzeltme"], {
      error: "Geçersiz etiket.",
    })
    .optional(),
  postIds: z.array(z.uuid()).max(20).optional(),
});

export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const entries = await getDb()
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        body: changelogEntries.body,
        label: changelogEntries.label,
        publishedAt: changelogEntries.publishedAt,
      })
      .from(changelogEntries)
      .orderBy(desc(changelogEntries.publishedAt))
      .limit(50);

    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    console.error(
      "GET /api/admin/changelog failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Liste alınamadı." },
      { status: 500 },
    );
  }
}

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

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Başlık 3-120, gövde 3-5000 karakter olmalı." },
        { status: 400 },
      );
    }
    const { title, body: entryBody, label, postIds } = parsed.data;

    // Gövde değişken adı çakışması: insert değerlerini ayrı kur.
    const [created] = await getDb()
      .insert(changelogEntries)
      .values({
        title,
        body: entryBody,
        label: label ?? null,
        createdBy: adminId,
      })
      .returning({ id: changelogEntries.id });

    if (postIds && postIds.length > 0) {
      await getDb()
        .insert(changelogPostLinks)
        .values(postIds.map((postId) => ({ entryId: created.id, postId })))
        .onConflictDoNothing();
    }

    return NextResponse.json(
      { success: true, data: { id: created.id } },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/changelog failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Duyuru kaydedilemedi." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const parsedId = z.uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz duyuru kimliği." },
        { status: 400 },
      );
    }

    // Linkler cascade ile gider.
    await getDb()
      .delete(changelogEntries)
      .where(eq(changelogEntries.id, parsedId.data));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      "DELETE /api/admin/changelog failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Duyuru silinemedi." },
      { status: 500 },
    );
  }
}
