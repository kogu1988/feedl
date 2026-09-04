import "server-only";

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getDefaultBoardId } from "@/lib/db/board";
import { getWorkspaceId } from "@/lib/db/workspace";
import { boards } from "@/lib/db/schema";

// Sprint 48b (madde 8) — board yönetimi. Varsayılan "genel" board
// silinemez (tüm mevcut fikirler ona bağlı); diğerleri ekle/düzenle/sil.

const slugRegex = /^[a-z0-9][a-z0-9-]{1,78}$/;
const visibilityEnum = z.enum(["public", "private"]);

// Türkçe karakterleri ASCII'ye çevir + slugify (boş satır -> boş string).
function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Board adı gerekli.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Slug yalnızca küçük harf, rakam ve tire içerebilir (2-79).")
    .optional()
    .or(
      z
        .string()
        .trim()
        .length(0)
        .transform(() => undefined),
    ),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => (value ? value : null)),
  visibility: visibilityEnum.default("public"),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Board bilgileri geçersiz.";
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 3; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function findBoard(id: string) {
  const [row] = await getDb()
    .select()
    .from(boards)
    .where(
      and(eq(boards.id, id), eq(boards.workspaceId, await getWorkspaceId())),
    )
    .limit(1);
  return row;
}

// GET /api/admin/boards — board listesi.
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
      .from(boards)
      .where(eq(boards.workspaceId, await getWorkspaceId()))
      .orderBy(asc(boards.sortOrder), asc(boards.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/boards failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Board'lar yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/boards — yeni board.
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
        { success: false, error: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const workspaceId = await getWorkspaceId();
    // Slug boşsa name'den otomatik üret (Türkçe karakterler dönüştürülür).
    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    try {
      const [created] = await getDb()
        .insert(boards)
        .values({
          workspaceId,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          visibility: parsed.data.visibility,
          sortOrder: parsed.data.sortOrder,
        })
        .returning();
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json(
          { success: false, error: "Bu slug zaten kullanımda." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    console.error(
      "POST /api/admin/boards failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Board eklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/boards/[id] olarak ayrıldı — aşağıdaki PATCH query id ile.
// DELETE /api/admin/boards?id=...
export async function PATCH(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !z.uuid().safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz board kimliği." },
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
    const update = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).nullish(),
        visibility: visibilityEnum.optional(),
        sortOrder: z.number().int().min(0).max(9999).optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: "Güncellenecek bir alan gerekli.",
      })
      .safeParse(body);
    if (!update.success) {
      return NextResponse.json(
        { success: false, error: "Board bilgileri geçersiz." },
        { status: 400 },
      );
    }
    const [current] = await getDb()
      .select()
      .from(boards)
      .where(
        and(eq(boards.id, id), eq(boards.workspaceId, await getWorkspaceId())),
      )
      .limit(1);
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Board bulunamadı." },
        { status: 404 },
      );
    }
    const defaultBoardId = await getDefaultBoardId();
    if (current.id === defaultBoardId && update.data.visibility === "private") {
      return NextResponse.json(
        { success: false, error: "Varsayılan board gizli yapılamaz." },
        { status: 400 },
      );
    }
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (update.data.name !== undefined) set.name = update.data.name;
    if (update.data.description !== undefined)
      set.description = update.data.description;
    if (update.data.visibility !== undefined)
      set.visibility = update.data.visibility;
    if (update.data.sortOrder !== undefined)
      set.sortOrder = update.data.sortOrder;
    const [updated] = await getDb()
      .update(boards)
      .set(set)
      .where(eq(boards.id, current.id))
      .returning();
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/boards failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Board güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/boards?id=... — board sil (varsayılan silinemez).
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !z.uuid().safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz board kimliği." },
        { status: 400 },
      );
    }
    const defaultBoardId = await getDefaultBoardId();
    if (id === defaultBoardId) {
      return NextResponse.json(
        { success: false, error: "Varsayılan board silinemez." },
        { status: 400 },
      );
    }
    const [deleted] = await getDb()
      .delete(boards)
      .where(
        and(eq(boards.id, id), eq(boards.workspaceId, await getWorkspaceId())),
      )
      .returning({ id: boards.id, name: boards.name });
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Board bulunamadı." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/boards failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Board silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
