import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { widgetOrigins } from "@/lib/db/schema";
import {
  invalidateOriginsCache,
  listWidgetOrigins,
  normalizeWidgetOrigin,
} from "@/lib/widget/origins";

// Sprint 38 — widget origin allowlist yönetimi (PM raporu §8.2). Buraya
// eklenen origin'ler /api/widget/* isteklerinde kabul edilir; feedl'in
// kendi origin'i ve FEEDL_WIDGET_ALLOWED_ORIGINS listesi her zaman geçerli.

const createSchema = z.object({
  origin: z.string().trim().min(1, "Origin gerekli.").max(200),
  label: z.string().trim().max(120).optional(),
});

// GET /api/admin/widget-origins — izinli origin listesi.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rows = await listWidgetOrigins();
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/widget-origins failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Origin listesi yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/widget-origins — origin ekle (normalize edilmiş, tekil).
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
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

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Origin 1-200, etiket en fazla 120 karakter olmalı." },
        { status: 400 },
      );
    }

    const origin = normalizeWidgetOrigin(parsed.data.origin);
    if (!origin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Geçersiz origin. Örnek biçim: https://siteniz.com (yalnızca scheme + alan adı, yol olamaz).",
        },
        { status: 400 },
      );
    }

    try {
      const [created] = await getDb()
        .insert(widgetOrigins)
        .values({
          workspaceId: await getWorkspaceId(),
          origin,
          label: parsed.data.label || null,
        })
        .returning({
          id: widgetOrigins.id,
          origin: widgetOrigins.origin,
          label: widgetOrigins.label,
        });

      invalidateOriginsCache();
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      // unique (workspace_id, origin) — aynı origin tekrar ekleniyorsa dostça 409.
      if ((err as { code?: string }).code === "23505") {
        return NextResponse.json(
          { success: false, error: "Bu origin zaten kayıtlı." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    console.error(
      "POST /api/admin/widget-origins failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Origin eklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/widget-origins?id=... — origin sil.
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rawId = new URL(req.url).searchParams.get("id") ?? "";
    const parsed = z.uuid().safeParse(rawId);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz origin kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(widgetOrigins)
      .where(
        and(
          eq(widgetOrigins.id, parsed.data),
          eq(widgetOrigins.workspaceId, await getWorkspaceId()),
        ),
      )
      .returning({ id: widgetOrigins.id, origin: widgetOrigins.origin });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Origin bulunamadı." },
        { status: 404 },
      );
    }

    invalidateOriginsCache();
    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/widget-origins failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Origin silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
