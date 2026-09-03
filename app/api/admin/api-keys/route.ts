import "server-only";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { apiKeys } from "@/lib/db/schema";

// Sprint 34 — admin API key yönetimi. Tam anahtar YALNIZCA oluşturma
// yanıtında bir kez döner; DB'de SHA-256 karması tutulur. Revocation:
// revokedAt set edilir (soft delete), kayıt denetim için kalır.

const createSchema = z.object({
  name: z.string().trim().min(1, "Anahtar adı gerekli.").max(100),
});

// GET /api/admin/api-keys — anahtarları listele (prefix + durum).
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
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/api-keys failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Anahtarlar yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/api-keys — yeni anahtar üret; tam değer bir kez döner.
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
        { success: false, error: "Anahtar adı 1-100 karakter olmalı." },
        { status: 400 },
      );
    }

    const { key, prefix, keyHash } = generateApiKey();
    const [created] = await getDb()
      .insert(apiKeys)
      .values({
        workspaceId: await getWorkspaceId(),
        name: parsed.data.name,
        prefix,
        keyHash,
      })
      .returning({ id: apiKeys.id, prefix: apiKeys.prefix });

    return NextResponse.json(
      { success: true, data: { id: created.id, prefix: created.prefix, key } },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/api-keys failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Anahtar oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/api-keys?id=... — anahtarı iptal et (revoke).
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
        { success: false, error: "Geçersiz anahtar kimliği." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, parsed.data))
      .returning({ id: apiKeys.id, prefix: apiKeys.prefix });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Anahtar bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "DELETE /api/admin/api-keys failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Anahtar iptal edilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
