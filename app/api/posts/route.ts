import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { createPostSchema } from "@/lib/validations/post";

// GET /api/posts — herkese açık fikir listesi (en son eklenen en üstte).
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fikirler yüklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// POST /api/posts — yeni fikir. Middleware bu rotayı public tutar; giriş
// zorunluluğu handler içinde kontrol edilir (plan.md Sprint 2).
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
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

    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Başlık veya açıklama geçersiz." },
        { status: 400 },
      );
    }

    const [created] = await getDb()
      .insert(posts)
      .values({
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
      })
      .returning({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        createdAt: posts.createdAt,
      });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fikir kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
