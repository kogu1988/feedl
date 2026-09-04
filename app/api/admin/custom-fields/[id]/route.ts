import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { customFields } from "@/lib/db/schema";
import {
  firstIssueMessage,
  updateCustomFieldSchema,
} from "@/lib/validations/custom-field";

// Sprint 42 (PM raporu §8.5) — tek özel alan tanımının güncellenmesi ve
// silinmesi. Silinen alanın değerleri (post_custom_values) FK cascade ile
// birlikte gider.

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 3; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// PATCH /api/admin/custom-fields/[id] — alan güncelle.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const fieldId = z.uuid().safeParse(id);
    if (!fieldId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz alan kimliği." },
        { status: 400 },
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

    const parsed = updateCustomFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();

    const [current] = await getDb()
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.id, fieldId.data),
          eq(customFields.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Alan bulunamadı." },
        { status: 404 },
      );
    }

    const { name, fieldType, options, required, showOnPortal, displayOrder } =
      parsed.data;

    const nextType = fieldType ?? current.fieldType;

    // Nihai tür select değilse seçenekler temizlenir; select ise
    // gövdede gelen (yoksa mevcut) seçenekler kullanılır.
    let nextOptions: string[] | null = null;
    if (nextType === "select") {
      const merged = Array.from(new Set(options ?? current.options ?? []));
      if (merged.length === 0) {
        return NextResponse.json(
          { success: false, error: "Seçim listesi (select) için en az bir seçenek gerekir." },
          { status: 400 },
        );
      }
      nextOptions = merged;
    }

    if (name && name !== current.name) {
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
      if (existing && existing.id !== fieldId.data) {
        return NextResponse.json(
          { success: false, error: "Bu alan adı zaten kayıtlı." },
          { status: 409 },
        );
      }
    }

    try {
      const [updated] = await getDb()
        .update(customFields)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(fieldType !== undefined ? { fieldType } : {}),
          options: nextOptions,
          ...(required !== undefined ? { required } : {}),
          ...(showOnPortal !== undefined ? { showOnPortal } : {}),
          ...(displayOrder !== undefined ? { displayOrder } : {}),
        })
        .where(
          and(
            eq(customFields.id, fieldId.data),
            eq(customFields.workspaceId, workspaceId),
          ),
        )
        .returning();

      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
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
      "PATCH /api/admin/custom-fields/[id] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Alan güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/custom-fields/[id] — alanı ve değerlerini sil.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const fieldId = z.uuid().safeParse(id);
    if (!fieldId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz alan kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(customFields)
      .where(
        and(
          eq(customFields.id, fieldId.data),
          eq(customFields.workspaceId, await getWorkspaceId()),
        ),
      )
      .returning({ id: customFields.id, name: customFields.name });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Alan bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/custom-fields/[id] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Alan silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
