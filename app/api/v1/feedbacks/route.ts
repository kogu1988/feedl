import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { apiKeys, posts } from "@/lib/db/schema";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { upsertApiUser } from "@/lib/users/api-user";
import { inngest } from "@/inngest/client";

// Sprint 44 (PM raporu §9 madde 7 — ilk canlı connector): dış bir sistem
// (Intercom benzeri, kendi uygulaması, Slack vb.) bir geri bildirim mesajını
// buraya POST eder. Mesajdan fikir oluşturulur, `source` ile etiketlenir ve
// `post/created` yayınlanır → AI Autopilot duygu/etiket/özet üretir. Yapısal
// bir başlık yerine serbest metin alır (Autopilot'ın triage değerini kanıtlar).

const INBOUND_SOURCE_RE = /^[a-zA-Z0-9_-]{1,40}$/;

const createSchema = z.object({
  source: z
    .string()
    .trim()
    .min(1, "Kaynak gereklidir.")
    .max(40)
    .regex(INBOUND_SOURCE_RE, "Kaynak yalnızca harf, rakam, _ ve - içerebilir."),
  author: z.object({
    email: z.string().trim().email().min(3).max(200),
    name: z.string().trim().max(100).optional(),
  }),
  message: z.string().trim().min(10, "Mesaj en az 10 karakter olmalı.").max(4000),
  title: z.string().trim().min(3).max(140).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    if (!key.scopes.includes("write")) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu işlem write kapsamı olan bir API anahtarı gerektirir.",
        },
        { status: 403 },
      );
    }
    const rl = await checkRateLimit(key.id);
    if (!rl.allowed) {
      return NextResponse.json(API_KEY_ERRORS.rateLimited(rl.retryAfterSec), {
        status: 429,
      });
    }
    try {
      await getDb()
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));
    } catch {
      // yoksay
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
        {
          success: false,
          error: "Kaynak 1-40 karakter, mesaj 10-4000 karakter olmalı.",
        },
        { status: 400 },
      );
    }

    const author = await upsertApiUser(
      parsed.data.author.email,
      parsed.data.author.name,
    );

    // Başlık verilmediyse mesajın ilk satırından (en fazla 140 kırpılır).
    const autoTitle =
      parsed.data.title ??
      parsed.data.message.split("\n").find((l) => l.trim())?.slice(0, 140) ??
      "Yeni geri bildirim";

    const [created] = await getDb()
      .insert(posts)
      .values({
        workspaceId: await getWorkspaceId(),
        userId: author.id,
        title: autoTitle,
        description: parsed.data.message,
        boardId: await getDefaultBoardId(),
        source: `inbound:${parsed.data.source}`,
      })
      .returning({ id: posts.id, title: posts.title });

    try {
      await inngest.send({
        name: "post/created",
        data: postCreatedEventSchema.parse({
          postId: created.id,
          title: created.title,
          description: parsed.data.message,
          userId: author.id,
        }),
      });
    } catch (eventErr) {
      console.error(
        "[api/v1/feedbacks] POST event failed:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

    return NextResponse.json(
      { success: true, data: { id: created.id, title: created.title } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/v1/feedbacks] POST failed:", err);
    return NextResponse.json(
      { success: false, error: "Geri bildirim alınamadı." },
      { status: 500 },
    );
  }
}
