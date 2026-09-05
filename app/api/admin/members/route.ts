import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { users } from "@/lib/db/schema";
import {
  hasWorkspaceAdminAccess,
  listWorkspaceMembers,
  removeWorkspaceMember,
  upsertWorkspaceMember,
  type WorkspaceMemberRole,
} from "@/lib/db/membership";
import { enforceLimit } from "@/lib/paddle";

// Sprint 48c-2 (madde 8) — workspace üyeleri ve rol matrisi. Üye ekle/rol
// değiştir/çıkar; roller owner/admin/member. Son owner kaldırılamaz.

const roleEnum = z.enum(["owner", "admin", "member"]);
const memberSchema = z.object({
  userId: z.string().min(1, "Kullanıcı gerekli."),
  role: roleEnum.default("member"),
});

const updateSchema = z.object({
  userId: z.string().min(1, "Kullanıcı gerekli."),
  role: roleEnum,
});

// GET /api/admin/members — üye listesi (+ rol).
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const rows = await listWorkspaceMembers();
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üyeler yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/members — üye ekle (yalnızca var olan Clerk kullanıcısı).
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
    const parsed = memberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı ve rol geçersiz." },
        { status: 400 },
      );
    }

    // Kullanıcının Clerk üzerinde var olduğunu doğrula (users tablosu).
    const [user] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı bulunamadı (Clerk webhook ile kayıt olmalı)." },
        { status: 404 },
      );
    }

    // Sprint 48i: plan üye limiti — yeni üye eklerken mevcut üye sayısı
    // limite ulaştıysa reddet.
    const existingMembers = await listWorkspaceMembers();
    const memberCheck = await enforceLimit("member", existingMembers.length);
    if (!memberCheck.ok) {
      return NextResponse.json(
        { success: false, error: memberCheck.message },
        { status: 403 },
      );
    }

    const created = await upsertWorkspaceMember(
      parsed.data.userId,
      parsed.data.role as WorkspaceMemberRole,
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error(
      "POST /api/admin/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üye eklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/members — rol değiştir.
export async function PATCH(req: Request) {
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı ve rol geçersiz." },
        { status: 400 },
      );
    }
    const updated = await upsertWorkspaceMember(
      parsed.data.userId,
      parsed.data.role as WorkspaceMemberRole,
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Rol güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/members?userId=... — üyeyi çıkar (son owner kaldırılamaz).
export async function DELETE(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId || !userId.startsWith("user_")) {
      return NextResponse.json(
        { success: false, error: "Geçersiz kullanıcı." },
        { status: 400 },
      );
    }
    try {
      await removeWorkspaceMember(userId);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Üye çıkarılamadı." },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: { userId } });
  } catch (err) {
    console.error(
      "DELETE /api/admin/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üye çıkarılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
