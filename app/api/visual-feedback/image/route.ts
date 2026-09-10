import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { posts } from "@/lib/db/schema";

// Faz 2 — private Vercel Blob store'daki görsel feedback ekran görüntüsünü
// YALNIZ admin'e akıtır. Public URL olmadığı için doğrudan <img> çalışmaz;
// admin kartı bu route'a bağlanır. Tenant izolasyonu: post, isteğin
// workspace'ine ait olmalı (aksi halde 404).
export const dynamic = "force-dynamic";

const querySchema = z.object({ postId: z.uuid() });

export async function GET(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz." },
        { status: 401 },
      );
    }
    const parsed = querySchema.safeParse({
      postId: new URL(req.url).searchParams.get("postId"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({ screenshotUrl: posts.screenshotUrl })
      .from(posts)
      .where(
        and(
          eq(posts.id, parsed.data.postId),
          eq(posts.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!row?.screenshotUrl) {
      return NextResponse.json(
        { success: false, error: "Ekran görüntüsü yok." },
        { status: 404 },
      );
    }

    const { get } = await import("@vercel/blob");
    const result = await get(row.screenshotUrl, { access: "private" });
    if (!result || !result.stream) {
      return NextResponse.json(
        { success: false, error: "Görsel alınamadı." },
        { status: 404 },
      );
    }
    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob?.contentType ?? "image/webp",
        // Private; tarayıcıda kısa süre önbelleklenebilir (admin oturumuyla).
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error(
      "GET /api/visual-feedback/image failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Görsel alınamadı." },
      { status: 500 },
    );
  }
}
