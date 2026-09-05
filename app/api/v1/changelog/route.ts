import { NextRequest, NextResponse } from "next/server";

import { desc, eq, sql } from "drizzle-orm";

import {
  API_KEY_ERRORS,
  authenticateApiKey,
  checkRateLimit,
} from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { apiKeys, changelogEntries } from "@/lib/db/schema";

// Sprint 43 — Public API (P4.2): yayınlanmış duyuru listesi. Webhook
// event matrix'ini tamamlar (changelog.published kaynağı). Yalnızca
// publishedAt'ı olan girdiler döner.

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

    const db = getDb();
    // Tenant izolasyonu: API anahtarının workspace'i (host değil).
    const where = eq(changelogEntries.workspaceId, key.workspaceId);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(changelogEntries)
      .where(where);

    const rows = await db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        body: changelogEntries.body,
        label: changelogEntries.label,
        imageUrl: changelogEntries.imageUrl,
        publishedAt: changelogEntries.publishedAt,
      })
      .from(changelogEntries)
      .where(where)
      .orderBy(desc(changelogEntries.publishedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: { entries: rows, page, limit, total },
    });
  } catch (err) {
    console.error("[api/v1/changelog] GET failed:", err);
    return NextResponse.json(
      { success: false, error: "Duyurular alınamadı." },
      { status: 500 },
    );
  }
}
