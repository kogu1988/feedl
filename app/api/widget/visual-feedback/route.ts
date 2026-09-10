import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { getWorkspaceId, resolveWorkspaceIdFromSlug } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { postFollowers, posts } from "@/lib/db/schema";
import { visualFeedbackSchema } from "@/lib/validations/post";
import { resolveClientContext } from "@/lib/client-context";
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

// Faz 2 — görsel feedback: kullanıcı müşteri sitesinde bir noktayı işaretler
// (pinX/pinY viewport yüzdesi) + açıklama yazar; otomatik teknik bağlam
// (cihaz/viewport/tarayıcı/OS/URL) eklenir. Ekran görüntüsü opsiyoneldir ve
// BLOB_READ_WRITE_TOKEN varsa Vercel Blob'a yüklenir; yoksa görüntüsüz post
// oluşur (özellik yine de çalışır). Kimlik/moda/widget-posts ile AYNIdır.

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB ikili (base64 ~2MB)

// data URL ("data:image/webp;base64,....") → Buffer. Blob token yoksa null.
async function uploadScreenshot(
  dataUrl: string,
  workspaceId: string,
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const match = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) return null;
  const [, contentType, b64] = match;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;
  try {
    const { put } = await import("@vercel/blob");
    const ext = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
    const blob = await put(
      `visual-feedback/${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      buffer,
      { access: "public", contentType, token },
    );
    return blob.url;
  } catch (err) {
    console.error(
      "visual-feedback screenshot upload failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

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

    const workspaceId =
      (await resolveWorkspaceIdFromSlug(req.nextUrl.searchParams.get("ws"))) ??
      (await getWorkspaceId());
    const { mode } = await getWidgetSubmissionSettings(workspaceId);

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
          error: "Geri bildirim göndermek için uygulamanız üzerinden giriş yapmalısınız.",
        },
        { status: 401 },
      );
    }

    const rl = await enforceRateLimit("widget:visual", userId, {
      limit: 6,
      windowSec: 60,
    });
    if (!rl.allowed) return rl.response!;
    const ipRl = await enforceRateLimit("widget:visual:ip", clientIpFrom(req), {
      limit: 20,
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

    const parsed = visualFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Başlık veya açıklama geçersiz." },
        { status: 400 },
      );
    }

    const ctx = resolveClientContext(
      parsed.data.clientContext,
      req.headers.get("user-agent") ?? "",
    );
    const screenshotUrl = parsed.data.screenshot
      ? await uploadScreenshot(parsed.data.screenshot, workspaceId)
      : null;

    const [created] = await getDb()
      .insert(posts)
      .values({
        workspaceId,
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
        boardId: await getDefaultBoardId(),
        widgetOrigin: origin?.slice(0, 200) ?? null,
        source: "visual_feedback",
        deviceType: ctx.device,
        viewportWidth: ctx.viewportWidth,
        viewportHeight: ctx.viewportHeight,
        browser: ctx.browser,
        os: ctx.os,
        pageUrl: ctx.pageUrl,
        pinX: parsed.data.pinX,
        pinY: parsed.data.pinY,
        screenshotUrl,
      })
      .returning({ id: posts.id, title: posts.title, status: posts.status });

    try {
      await getDb()
        .insert(postFollowers)
        .values({ postId: created.id, userId })
        .onConflictDoNothing();
    } catch (followErr) {
      console.error(
        "visual-feedback auto-follow failed:",
        followErr instanceof Error ? followErr.message : followErr,
      );
    }

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
        "visual-feedback post/created event could not be sent:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

    return NextResponse.json(
      { success: true, data: { ...created, screenshot: Boolean(screenshotUrl) } },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/widget/visual-feedback failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Geri bildirim kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
