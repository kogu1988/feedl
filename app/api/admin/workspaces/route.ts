import "server-only";

import { NextResponse } from "next/server";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { boards, workspaces, workspaceMembers } from "@/lib/db/schema";
import {
  FREE_WORKSPACE_LIMIT_MESSAGE,
  loadWorkspaceCreationAllowance,
} from "@/lib/db/workspace-limits";

// Sprint 48g (madde 8) — çoklu workspace. Ana workspace (feedl) admin'i
// yeni workspace oluşturur; her workspace kendi boards/posts/üyeleriyle
// izoledir. Oluşturma = workspace + varsayılan 'Genel' board + oluşturan
// admin'i owner yapma (sıralı insert; başarısızsa workspace silinir).

const slugRegex = /^[a-z0-9][a-z0-9-]{1,62}$/;
const createSchema = z.object({
  name: z.string().trim().min(1, "Workspace adı gerekli.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Slug yalnızca küçük harf, rakam ve tire içerebilir (2-63).")
    .optional()
    .or(
      z
        .string()
        .trim()
        .length(0)
        .transform(() => undefined),
    ),
});

// Türkçe karakterleri ASCII'ye çevir + slugify.
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

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 3; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// GET /api/admin/workspaces — kullanıcının ÜYE OLDUĞU workspace'ler.
//
// 2026-09-12 (kullanıcı): eskiden workspace'lerin TAMAMI dönüyordu (kullanıcı
// filtresi yoktu) — yani bir kiracının sahibi, başka kiracıların ad/slug/domain
// bilgisini görüyordu. Liste aynı zamanda workspace SEÇİCİSİ olduğu için kapsam
// "erişebildiğin workspace'ler" olmalı.
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
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        customDomain: workspaces.customDomain,
        createdAt: workspaces.createdAt,
        // Arayüz `WorkspaceView.boardCount` bekler; bu alan eksikken yeni
        // oluşturulan bir workspace listede "undefined board" gösteriyordu
        // (2026-09-12 doğrulandı).
        boardCount: count(boards.id),
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, workspaces.id),
      )
      .leftJoin(boards, eq(boards.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, adminId))
      .groupBy(workspaces.id)
      .orderBy(asc(workspaces.createdAt));
    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({ ...row, boardCount: Number(row.boardCount) })),
    });
  } catch (err) {
    console.error(
      "GET /api/admin/workspaces failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace'ler yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/workspaces — yeni workspace + varsayılan board + owner.
export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    // 2026-09-12 (kullanıcı kararı): Free hesap 1 workspace. Kural ve gerekçe:
    // lib/db/workspace-limits.ts. Arayüz butonu kapatsa da kapı BURADA —
    // istemci atlatılsa bile kaçak açılamaz.
    const allowance = await loadWorkspaceCreationAllowance(adminId);
    if (!allowance.allowed) {
      return NextResponse.json(
        { success: false, error: FREE_WORKSPACE_LIMIT_MESSAGE },
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
        { success: false, error: "Workspace bilgileri geçersiz (sluq 2-63, küçük harf/tire)." },
        { status: 400 },
      );
    }
    // Slug boşsa name'den otomatik üret (Türkçe karakterler dönüştürülür).
    const wsSlug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!wsSlug) {
      return NextResponse.json(
        { success: false, error: "Slug üretilemedi; ad en az 2 karakter olmalı." },
        { status: 400 },
      );
    }

    try {
      const [created] = await getDb()
        .insert(workspaces)
        .values({ name: parsed.data.name, slug: wsSlug })
        .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug });

      // Varsayılan board + owner (sıralı; workspace oluştuğu için her ikisi
      // de aynı workspace'e yazılır).
      try {
        await getDb()
          .insert(boards)
          .values({
            workspaceId: created.id,
            name: "Genel",
            slug: "genel",
            visibility: "public",
            sortOrder: 0,
          });
        await getDb()
          .insert(workspaceMembers)
          .values({ workspaceId: created.id, userId: adminId, role: "owner" });
      } catch (seedErr) {
        // Seed başarısızsa workspace'i geri al (best-effort) — kısmi boş kalmasın.
        await getDb().delete(workspaces).where(eq(workspaces.id, created.id)).catch(() => {});
        console.error(
          "POST /api/admin/workspaces seed failed:",
          seedErr instanceof Error ? seedErr.message : seedErr,
        );
        throw seedErr;
      }

      return NextResponse.json(
        { success: true, data: created },
        { status: 201 },
      );
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
      "POST /api/admin/workspaces failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
