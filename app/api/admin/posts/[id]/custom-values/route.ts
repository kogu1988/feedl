import "server-only";

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { customFields, posts, postCustomValues } from "@/lib/db/schema";
import type { CustomField } from "@/lib/db/schema";

// Sprint 42 (PM raporu §8.5) — bir fikrin özel alan değerlerini kaydet.
// Her alan türü kendi doğrulamasını taşır (number/date/select); zorunlu
// alanlar boş bırakılamaz. Boş değer = alanı temizle (null).

const bodySchema = z.object({
  // key = fieldId, value = gösterim metni ("" → temizle)
  values: z.record(z.string(), z.string().max(2000)),
});

function normalizeValue(
  field: CustomField,
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    // Zorunlu alan boş bırakılamaz — yalnızca temizleme durumunda izin ver.
    if (field.required) {
      return { ok: false, error: `"${field.name}" alanı zorunlu.` };
    }
    return { ok: true, value: null };
  }

  switch (field.fieldType) {
    case "number": {
      if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) {
        return { ok: false, error: `"${field.name}" geçerli bir sayı değil.` };
      }
      return { ok: true, value: trimmed.replace(",", ".") };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return { ok: false, error: `"${field.name}" geçerli bir tarih değil.` };
      }
      return { ok: true, value: trimmed };
    }
    case "select": {
      if (!field.options?.includes(trimmed)) {
        return {
          ok: false,
          error: `"${field.name}" için geçersiz seçenek.`,
        };
      }
      return { ok: true, value: trimmed };
    }
    case "text":
    default:
      return { ok: true, value: trimmed };
  }
}

// POST /api/admin/posts/[id]/custom-values — fikrin alanlarını kaydet.
export async function POST(
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
    const postId = z.uuid("Geçersiz fikir kimliği.").safeParse(id);
    if (!postId.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fikir kimliği." },
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

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Değerler geçersiz." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();

    // Fikir workspace'e ait mi? (rol kontrolü DB'den; FK güvenliği için de
    // fikri doğrularız.)
    const [post] = await getDb()
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId.data), eq(posts.workspaceId, workspaceId)))
      .limit(1);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Fikir bulunamadı." },
        { status: 404 },
      );
    }

    // Workspace'in tanımlı alanlarını yükle — geçersiz fieldId'ler elenir.
    const fields = await getDb()
      .select()
      .from(customFields)
      .where(eq(customFields.workspaceId, workspaceId));
    const fieldMap = new Map(fields.map((f) => [f.id, f]));

    const rows: {
      postId: string;
      fieldId: string;
      value: string | null;
    }[] = [];

    for (const [fieldId, raw] of Object.entries(parsed.data.values)) {
      const field = fieldMap.get(fieldId);
      if (!field) {
        return NextResponse.json(
          { success: false, error: "Geçersiz alan." },
          { status: 400 },
        );
      }
      const result = normalizeValue(field, raw);
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }
      rows.push({ postId: postId.data, fieldId, value: result.value });
    }

    if (rows.length > 0) {
      // (post_id, field_id) unique üzerinden upsert — tek statement, neon-http
      // transaction'sız set tabanlı yazma.
      await getDb()
        .insert(postCustomValues)
        .values(rows)
        .onConflictDoUpdate({
          target: [postCustomValues.postId, postCustomValues.fieldId],
          set: {
            value: sql`excluded.value`,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "POST /api/admin/posts/[id]/custom-values failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Değerler kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
