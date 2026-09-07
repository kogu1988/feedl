import { NextResponse, type NextRequest } from "next/server";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId, resolveWorkspaceIdFromSlug } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { postFollowers, posts, votes } from "@/lib/db/schema";
import { createPostSchema } from "@/lib/validations/post";
import { buildPostSearch } from "@/lib/post-search";
import { inngest } from "@/inngest/client";
import { getWidgetSession } from "@/lib/widget/jwt";
import { isOriginAllowed } from "@/lib/widget/origins";
import { requestOrigin } from "@/lib/widget/http";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";
import {
  anonymousWidgetUserId,
  ensureWidgetUser,
  getWidgetSubmissionSettings,
} from "@/lib/widget/submission";

// Widget fikir listesi (plan.md Sprint 32): iframe içindeki kompakt arayüz
// portal ile aynı arama altyapısını (lib/post-search) kullanır. Birleşmiş
// fikirler portaldaki gibi listede yer almaz.

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
    const session = await getWidgetSession();
    // Oturum yoksa eşleşen oy olmaz: filter koşulu hiçbir satırı seçmez.
    const sessionUserId = session?.userId ?? "";

    const rows = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        createdAt: posts.createdAt,
        voteCount: count(votes.id),
        voted: sql<number>`count(${votes.id}) filter (where ${votes.userId} = ${sessionUserId})`,
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          isNull(posts.mergedIntoId),
          search.condition,
        ),
      )
      .groupBy(posts.id)
      .orderBy(
        ...(search.tokens.length > 0
          ? [desc(search.score), desc(sql`count(${votes.id})`)]
          : [desc(sql`count(${votes.id})`)]),
        desc(posts.createdAt),
      )
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        authenticated: Boolean(session),
        posts: rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          createdAt: row.createdAt,
          voteCount: Number(row.voteCount),
          voted: Number(row.voted) > 0,
        })),
      },
    });
  } catch (err) {
    console.error(
      "GET /api/widget/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fikirler yüklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// POST — fikir oluşturma. Moda göre kimlik: signup/email → oturum (email
// oturumu email'den kurulur); anonymous → oturum GEREKMEZ, IP tabanlı kararlı
// widget kimliği kullanılır (1 IP aynı kimlik). Workspace, iframe `?ws=<slug>`
// üzerinden (anonim/read-only) önce çözülür.
export async function POST(req: NextRequest) {
  try {
    const session = await getWidgetSession();
    const origin = session?.origin ?? requestOrigin(req);
    if (!(await isOriginAllowed(origin))) {
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
        { status: 403 },
      );
    }

    // Workspace: ?ws (slug) önce; yoksa oturum/host. Anonim iframe'de oturum
    // çerezi olmayabilir → `?ws` belirleyicidir.
    const workspaceId =
      (await resolveWorkspaceIdFromSlug(req.nextUrl.searchParams.get("ws"))) ??
      (await getWorkspaceId());
    const { mode } = await getWidgetSubmissionSettings(workspaceId);

    // Anonim mod: oturum zorunlu DEĞİL → IP tabanlı widget kimliği.
    // Email/signup mod: oturum zorunlu (email oturumu email'den kurulur).
    let userId = session?.userId ?? null;
    if (mode === "anonymous") {
      if (!userId) {
        const ip = clientIpFrom(req);
        userId = anonymousWidgetUserId(ip);
        await ensureWidgetUser({ userId });
      }
    } else if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Fikir göndermek için uygulamanız üzerinden giriş yapmalısınız.",
        },
        { status: 401 },
      );
    }

    // Sprint 60: widget fikir oluşturma — AI autopilot maliyet amplifikasyonunu
    // kesmek için session kullanıcısı + IP frekans limiti.
    const rl = await enforceRateLimit("widget:posts", userId, {
      limit: 8,
      windowSec: 60,
    });
    if (!rl.allowed) return rl.response!;
    const ipRl = await enforceRateLimit("widget:posts:ip", clientIpFrom(req), {
      limit: 30,
    });
    if (!ipRl.allowed) return ipRl.response!;

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
        workspaceId,
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
        boardId: await getDefaultBoardId(),
        widgetOrigin: origin?.slice(0, 200) ?? null,
        source: "widget_embed",
      })
      .returning({
        id: posts.id,
        title: posts.title,
        status: posts.status,
      });

    // Yazar (widget kullanıcısı) fikrini otomatik takip eder.
    try {
      await getDb()
        .insert(postFollowers)
        .values({ postId: created.id, userId })
        .onConflictDoNothing();
    } catch (followErr) {
      console.error(
        "widget author auto-follow failed:",
        followErr instanceof Error ? followErr.message : followErr,
      );
    }

    // AI autopilot (etiket + duplicate tespiti) arka planda çalışır;
    // event başarısız olsa bile fikir kaydı başarılı kalmalıdır.
    try {
      await inngest.send({
        name: "post/created",
        data: {
          postId: created.id,
          title: created.title,
          description: parsed.data.description,
          userId,
        },
      });
    } catch (eventErr) {
      console.error(
        "widget post/created event could not be sent:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/widget/posts failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fikir kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
