import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import { getDefaultBoardId } from "@/lib/db/board";
import { widgetTriages, posts } from "@/lib/db/schema";
import { getWidgetSession } from "@/lib/widget/jwt";
import { isOriginAllowed } from "@/lib/widget/origins";
import { requestOrigin } from "@/lib/widget/http";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";

// Sprint 48l — widget AI triage. Mesajı sınıflandırır; feedback ise post
// oluşturur (ve post/created yayınlar), support/clarify/unrecognized ise
// yönlendirme yanıtı döner. Kayıt widget_triages'a yazılır.

const triageSchema = z.object({
  message: z.string().trim().min(3, "Mesaj en az 3 karakter olmalı.").max(2000),
});

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

    // Sprint 60 (rate limit hardening): her triage mesajı bir LLM çağrısıdır.
    // Sıkı pencere limiti (session kullanıcısı / IP) AI maliyetini korur.
    const triageRl = await enforceRateLimit(
      "widget:triage",
      session?.userId ?? clientIpFrom(req),
      { limit: 6, windowSec: 60 },
    );
    if (!triageRl.allowed) return triageRl.response!;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
    const parsed = triageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Mesaj 3-2000 karakter olmalı." },
        { status: 400 },
      );
    }

    const result = await classifyWidgetMessage(parsed.data.message);
    const classification = result.classification;
    const response = result.response ?? null;

    // Feedback → post oluştur (ilk satır başlık, tümü açıklama).
    let createdPostId: string | null = null;
    if (classification === "feedback") {
      const userId = session?.userId;
      if (!userId) {
        return NextResponse.json(
          {
            success: true,
            data: {
              classification,
              response:
                response ??
                "Bu bir geri bildirim gibi görünüyor. Göndermek için giriş yap (widget aracılığıyla).",
            },
          },
        );
      }
      const title =
        parsed.data.message.split("\n").find((line) => line.trim())?.slice(0, 140) ??
        "Geri bildirim";
      const [created] = await getDb()
        .insert(posts)
        .values({
          workspaceId: await getWorkspaceId(),
          boardId: await getDefaultBoardId(),
          userId,
          title,
          description: parsed.data.message,
          source: "widget_triage",
        })
        .returning({ id: posts.id, title: posts.title });
      createdPostId = created.id;
      try {
        await inngest.send({
          name: "post/created",
          data: postCreatedEventSchema.parse({
            postId: created.id,
            title: created.title,
            description: parsed.data.message,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error("widget triage post/created send failed:", eventErr);
      }
    }

    // Kayıt (audit) — best-effort.
    await getDb()
      .insert(widgetTriages)
      .values({
        workspaceId: await getWorkspaceId(),
        userId: session?.userId ?? null,
        message: parsed.data.message,
        classification,
        response,
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        classification,
        response:
          response ??
          (classification === "support"
            ? "Bu bir destek talebi gibi görünüyor. Yetkililer mail üzerinden size dönecek."
            : classification === "clarify"
              ? "Biraz daha detay verebilir misiniz? Ne bekliyorsunuz?"
              : classification === "unrecognized"
                ? "Bunu tam anlayamadım. Geri bildirim, destek veya netleştirme konusunda yazabilirsiniz."
                : "Geri bildiriminiz kaydedildi."),
        postId: createdPostId,
      },
    });
  } catch (err) {
    console.error("POST /api/widget/triage failed:", err);
    return NextResponse.json(
      { success: false, error: "Mesaj işlenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
