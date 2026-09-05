import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { postFollowers, posts, votes, boards } from "@/lib/db/schema";
import { createPostSchema } from "@/lib/validations/post";
import { inngest } from "@/inngest/client";
import { buildPostSearch } from "@/lib/post-search";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";

// GET /api/posts — herkese açık fikir listesi (en son eklenen en üstte),
// oy sayılarıyla birlikte. Opsiyonel ?q= ile çok kelimeli, diakritik
// duyarsız arama + alaka sıralaması (lib/post-search; plan.md Sprint 8:
// yazarken benzer post önerisi bu endpoint'i kullanır).
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length > 100) {
      return NextResponse.json(
        { success: false, error: "Arama terimi çok uzun." },
        { status: 400 },
      );
    }

    const search = buildPostSearch(q);

    const rows = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        createdAt: posts.createdAt,
        voteCount: count(votes.id),
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          search.condition,
        ),
      )
      .groupBy(posts.id)
      .orderBy(
        // Arama varken alaka önce gelir: skor → oy sayısı → tarih.
        ...(search.tokens.length > 0
          ? [desc(search.score), desc(sql`count(${votes.id})`)]
          : []),
        desc(posts.createdAt),
      )
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

    // Sprint 60 (rate limit hardening): kullanıcı + IP bazlı; ayrıca kullanıcı
    // başına kısa pencere frekans limiti (AI maliyet amplifikasyonunu keser —
    // her post ai-autopilot tetikler).
    const userRl = await enforceRateLimit("posts:user", userId, { limit: 10 });
    if (!userRl.allowed) return userRl.response!;
    const ipRl = await enforceRateLimit("posts:ip", clientIpFrom(req), { limit: 30 });
    if (!ipRl.allowed) return ipRl.response!;
    const freqRl = await enforceRateLimit("posts:freq", userId, {
      limit: 3,
      windowSec: 60,
    });
    if (!freqRl.allowed) return freqRl.response!;

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

    // Sprint 48d: boardId verildiyse workspace'te ve public olmalı (portal
    // oluşturma normal kullanıcı — private board seçilemez). Verilmediyse
    // varsayılan board (genel).
    let boardId = await getDefaultBoardId();
    if (parsed.data.boardId) {
      const [boardRow] = await getDb()
        .select({ id: boards.id, visibility: boards.visibility })
        .from(boards)
        .where(
          and(
            eq(boards.id, parsed.data.boardId),
            eq(boards.workspaceId, await getWorkspaceId()),
          ),
        )
        .limit(1);
      if (!boardRow) {
        return NextResponse.json(
          { success: false, error: "Geçersiz board." },
          { status: 400 },
        );
      }
      // Public olmayan bir board portal üzerinden seçilemez.
      if (boardRow.visibility !== "public") {
        return NextResponse.json(
          { success: false, error: "Bu board portal üzerinden seçilemez." },
          { status: 400 },
        );
      }
      boardId = parsed.data.boardId;
    }

    const [created] = await getDb()
      .insert(posts)
      .values({
        workspaceId: await getWorkspaceId(),
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
        boardId,
        source: "portal",
      })
      .returning({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        createdAt: posts.createdAt,
      });

    // Sprint 26: yazar fikrini otomatik takip eder.
    try {
      await getDb()
        .insert(postFollowers)
        .values({ postId: created.id, userId })
        .onConflictDoNothing();
    } catch (followErr) {
      console.error(
        "author auto-follow failed:",
        followErr instanceof Error ? followErr.message : followErr,
      );
    }

    // AI analizi arka planda Inngest ile çalışır (plan.md Sprint 5). Event
    // gönderimi başarısız olsa bile fikir kaydı başarılı kalmalıdır; lokalde
    // Dev Server kapalıyken veya production'da key yokken buraya düşer.
    try {
      await inngest.send({
        name: "post/created",
        data: {
          postId: created.id,
          title: created.title,
          description: created.description,
          userId,
        },
      });
    } catch (eventErr) {
      console.error(
        "post/created event could not be sent:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

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
