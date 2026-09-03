import "server-only";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { savedViews } from "@/lib/db/schema";

// Sprint 22: admin saved views — kaydedilmiş filtre kombinasyonları.
// params yalnızca dashboard filtre parametrelerini içerebilir
// (status/tag/sort); tanınmayan parametre reddedilir (güvenlik: ?v= gibi
// parametreler aracılığıyla beklenmedik yönlendirme yapılamaz).

const ALLOWED_PARAMS = new Set(["status", "tag", "sort"]);

const createSchema = z.object({
  name: z.string().trim().min(1, "Görünüm adı gerekli.").max(60),
  params: z
    .string()
    .max(200)
    .refine(
      (value) => {
        if (value.startsWith("?")) {
          return false;
        }
        const search = new URLSearchParams(value);
        const keys = [...search.keys()];
        return (
          keys.length > 0 && keys.every((key) => ALLOWED_PARAMS.has(key))
        );
      },
      { error: "Geçersiz filtre parametreleri." },
    ),
});

const deleteSchema = z.object({
  id: z.uuid("Geçersiz görünüm kimliği."),
});

// GET /api/admin/views — kayıtlı görünümleri listele.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rows = await getDb()
      .select()
      .from(savedViews)
      .orderBy(desc(savedViews.createdAt))
      .limit(20);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/views failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Görünümler yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/views — mevcut filtre kombinasyonunu kaydet.
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
        { success: false, error: "Görünüm adı 1-60 karakter olmalı ve filtre parametreleri geçerli olmalı." },
        { status: 400 },
      );
    }

    const [created] = await getDb()
      .insert(savedViews)
      .values({
        workspaceId: await getWorkspaceId(),
        name: parsed.data.name,
        params: parsed.data.params,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/admin/views failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Görünüm kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/views?id=... — kayıtlı görünümü sil.
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
    const parsed = deleteSchema.safeParse({ id: rawId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz görünüm kimliği." },
        { status: 400 },
      );
    }

    await getDb().delete(savedViews).where(eq(savedViews.id, parsed.data.id));

    return NextResponse.json({ success: true, data: { id: parsed.data.id } });
  } catch (err) {
    console.error(
      "DELETE /api/admin/views failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Görünüm silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
