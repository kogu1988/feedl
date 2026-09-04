import { NextRequest, NextResponse } from "next/server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { apiKeys, posts } from "@/lib/db/schema";
import {
  comments,
  postStatusEnum,
  postTags,
  tags,
  votes,
} from "@/lib/db/schema";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { upsertApiUser } from "@/lib/users/api-user";
import { inngest } from "@/inngest/client";

// Sprint 34 — Public API (P4.2). Bearer API key ile salt-okunur fikir
// listesi ve (Sprint 43) yeni fikir oluşturma. Kapsam/limit detayları:
// lib/api-keys.ts + docs/plan.md Sprint 34.

const createPostSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(2000),
  author: z
    .object({
      email: z.string().trim().email().min(3).max(200),
      name: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    const rl = await checkRateLimit(key.id);
    if (!rl.allowed) {
      return NextResponse.json(API_KEY_ERRORS.rateLimited(rl.retryAfterSec), {
        status: 429,
      });
    }

    // lastUsedAt güncellemesi best-effort: ana istek bu başarısızlıktan
    // etkilenmesin.
    try {
      await getDb()
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));
    } catch {
      // yoksay
    }

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(params.get("limit") ?? "25", 10) || 25),
    );

    const statusParam = params.get("status");
    let statusFilter: (typeof postStatusEnum.enumValues)[number] | null = null;
    if (statusParam) {
      if (!postStatusEnum.enumValues.includes(statusParam as never)) {
        return NextResponse.json(
          { success: false, error: "Geçersiz durum filtresi." },
          { status: 400 },
        );
      }
      statusFilter = statusParam as (typeof postStatusEnum.enumValues)[number];
    }

    const sort = params.get("sort") === "top" ? "top" : "recent";

    const tagParam = params.get("tag");
    const tagLower = tagParam ? tagParam.toLocaleLowerCase("tr") : null;

    const conditions = [
      eq(posts.workspaceId, await getWorkspaceId()),
      isNull(posts.mergedIntoId),
    ];
    if (statusFilter) {
      conditions.push(eq(posts.status, statusFilter));
    }
    if (tagLower) {
      conditions.push(
        inArray(
          posts.id,
          getDb()
            .select({ id: postTags.postId })
            .from(postTags)
            .innerJoin(tags, eq(tags.id, postTags.tagId))
            .where(
              and(
                eq(tags.workspaceId, await getWorkspaceId()),
                eq(tags.name, tagLower),
              ),
            ),
        ),
      );
    }
    const where = and(...conditions);

    const db = getDb();
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(posts)
      .where(where);

    const voteCountSql = sql<number>`(SELECT count(*) FROM ${votes} WHERE ${votes.postId} = ${posts.id})`;
    const commentCountSql = sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.isInternal} = false)`;

    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        postType: posts.postType,
        sentimentLabel: posts.sentimentLabel,
        aiKeywords: posts.aiKeywords,
        createdAt: posts.createdAt,
        voteCount: voteCountSql,
        commentCount: commentCountSql,
      })
      .from(posts)
      .where(where)
      .orderBy(
        ...(sort === "top"
          ? [desc(voteCountSql), desc(posts.createdAt)]
          : [desc(posts.createdAt)]),
      )
      .limit(limit)
      .offset((page - 1) * limit);

    // Etiketler ayrı sorguda (fan-out'suz) — sayfa id'lerine göre gruplanır.
    const pageIds = rows.map((r) => r.id);
    const tagRows = pageIds.length
      ? await db
          .select({ postId: postTags.postId, name: tags.name })
          .from(postTags)
          .innerJoin(tags, eq(tags.id, postTags.tagId))
          .where(inArray(postTags.postId, pageIds))
          .orderBy(asc(tags.name))
      : [];
    const tagMap = new Map<string, string[]>();
    for (const t of tagRows) {
      const list = tagMap.get(t.postId) ?? [];
      list.push(t.name);
      tagMap.set(t.postId, list);
    }

    return NextResponse.json({
      success: true,
      data: {
        posts: rows.map((r) => ({
          ...r,
          voteCount: Number(r.voteCount),
          commentCount: Number(r.commentCount),
          tags: tagMap.get(r.id) ?? [],
        })),
        page,
        limit,
        total,
      },
    });
  } catch (err) {
    console.error("[api/v1/posts] GET failed:", err);
    return NextResponse.json(
      { success: false, error: "Fikirler alınamadı." },
      { status: 500 },
    );
  }
}

// POST /api/v1/posts — yeni fikir oluştur (Sprint 43). API anahtarı ile
// authed; yazar (author) opsiyonel bir kimliktir — verilirse `api_` önekli
// stabil müşteri kullanıcısı upsert edilir, verilmezse fikri sahipsiz
// (authorId yok) bırakmamak için email zorunlu kabul edilir.
export async function POST(req: NextRequest) {
  try {
    const key = await authenticateApiKey(req);
    if (!key) {
      return NextResponse.json(API_KEY_ERRORS.unauthorized, { status: 401 });
    }
    if (!key.scopes.includes("write")) {
      return NextResponse.json(
        { success: false, error: "Bu işlem write kapsamı olan bir API anahtarı gerektirir." },
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

    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Başlık 3-140, açıklama 10-2000 karakter olmalı." },
        { status: 400 },
      );
    }

    // Yazar kimliği zorunlu: posts.user_id NOT NULL. Author yoksa 400.
    if (!parsed.data.author) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu işlem için bir yazar e-postası (author.email) gerekli.",
        },
        { status: 400 },
      );
    }

    const author = await upsertApiUser(
      parsed.data.author.email,
      parsed.data.author.name,
    );

    const [created] = await getDb()
      .insert(posts)
      .values({
        workspaceId: await getWorkspaceId(),
        userId: author.id,
        title: parsed.data.title,
        description: parsed.data.description,
        source: "api",
      })
      .returning({ id: posts.id, title: posts.title });

    // Auth sonrası Inngest event'ı (best-effort) — AI autopilot + webhook.
    try {
      await inngest.send({
        name: "post/created",
        data: postCreatedEventSchema.parse({
          postId: created.id,
          title: created.title,
          description: parsed.data.description,
          userId: author.id,
        }),
      });
    } catch (eventErr) {
      console.error(
        "[api/v1/posts] POST event send failed:",
        eventErr instanceof Error ? eventErr.message : eventErr,
      );
    }

    return NextResponse.json(
      { success: true, data: { id: created.id, title: created.title } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/v1/posts] POST failed:", err);
    return NextResponse.json(
      { success: false, error: "Fikir oluşturulamadı." },
      { status: 500 },
    );
  }
}
