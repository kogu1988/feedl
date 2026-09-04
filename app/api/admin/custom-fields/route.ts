import "server-only";

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { customFields } from "@/lib/db/schema";
import {
  createCustomFieldSchema,
  firstIssueMessage,
} from "@/lib/validations/custom-field";

// Sprint 42 (PM raporu §8.5) — özel alan tanımı yönetimi. Alanlar
// workspace'e bağlıdır; Sprint 21 taksonomi kararı korunur (postType =
// kategori, tags = serbest etiket; custom fields bunlardan bağımsızdır).

// drizzle 0.45 hatayı DrizzleQueryError.cause'a sarar; 23505 hem kök hem
// sarmalayıcıda olabilir — zinciri kısa tararız.
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 3; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// GET /api/admin/custom-fields — alan tanımlarını sırayla döndürür.
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
      .from(customFields)
      .where(eq(customFields.workspaceId, await getWorkspaceId()))
      .orderBy(asc(customFields.displayOrder), asc(customFields.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/custom-fields failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Özel alanlar yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/custom-fields — yeni alan tanımı.
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

    const parsed = createCustomFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const { name, fieldType, options, required, showOnPortal, displayOrder } =
      parsed.data;

    // Seçim listesi dışındaki türlerde seçenek saklanmaz; select'te
    // tekrarlar ayıklanır.
    const normalizedOptions =
      fieldType === "select"
        ? Array.from(new Set(options ?? []))
        : null;

    const [existing] = await getDb()
      .select({ id: customFields.id })
      .from(customFields)
      .where(
        and(
          eq(customFields.workspaceId, workspaceId),
          eq(customFields.name, name),
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Bu alan adı zaten kayıtlı." },
        { status: 409 },
      );
    }

    try {
      const [created] = await getDb()
        .insert(customFields)
        .values({
          workspaceId,
          name,
          fieldType,
          options: normalizedOptions,
          required,
          showOnPortal,
          displayOrder,
        })
        .returning();

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      // unique (workspace_id, name) — yarış durumu için yedek.
      if (isUniqueViolation(err)) {
        return NextResponse.json(
          { success: false, error: "Bu alan adı zaten kayıtlı." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    console.error(
      "POST /api/admin/custom-fields failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Özel alan eklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
