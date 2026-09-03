import "server-only";

import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { aiSuggestions, posts } from "@/lib/db/schema";

// GET /api/admin/inbox — bekleyen AI önerileri (sadece admin). Her öneride
// kaynak fikir + önerilen hedef fikir başlığı ile döner; admin approve/
// reject/ignore kararını POST ile verir.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const suggestionRows = await getDb()
      .select({
        id: aiSuggestions.id,
        postId: aiSuggestions.postId,
        type: aiSuggestions.type,
        payload: aiSuggestions.payload,
        confidence: aiSuggestions.confidence,
        createdAt: aiSuggestions.createdAt,
        sourceTitle: posts.title,
        sourceStatus: posts.status,
      })
      .from(aiSuggestions)
      .innerJoin(
        posts,
        and(
          eq(posts.id, aiSuggestions.postId),
          eq(posts.workspaceId, await getWorkspaceId()),
        ),
      )
      .where(eq(aiSuggestions.status, "pending"))
      .orderBy(desc(aiSuggestions.createdAt))
      .limit(50);

    // Hedef fikir başlıkları ikinci sorguda (join alias yerine basit okuma).
    const targetIds = [
      ...new Set(suggestionRows.map((row) => row.payload.duplicateOf)),
    ];
    const targetRows =
      targetIds.length > 0
        ? await getDb()
            .select({ id: posts.id, title: posts.title })
            .from(posts)
            .where(inArray(posts.id, targetIds))
        : [];
    const targetTitles = new Map(targetRows.map((row) => [row.id, row.title]));

    return NextResponse.json({
      success: true,
      data: suggestionRows.map((row) => ({
        id: row.id,
        postId: row.postId,
        type: row.type,
        confidence: row.confidence,
        note: row.payload.note,
        targetId: row.payload.duplicateOf,
        targetTitle: targetTitles.get(row.payload.duplicateOf) ?? null,
        sourceTitle: row.sourceTitle,
        sourceStatus: row.sourceStatus,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error(
      "GET /api/admin/inbox failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Inbox yüklenemedi." },
      { status: 500 },
    );
  }
}
