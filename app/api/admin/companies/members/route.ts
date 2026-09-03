import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { companies, companyMembers, users } from "@/lib/db/schema";

// Sprint 30 — şirket üyeleri: kullanıcı ↔ şirket eşleşmesi + ünvan.
// userId Clerk id'sidir (user_...) — z.uuid() KULLANILMAZ (plan.md
// Sprint 28 pitfall'ı); varlık kontrolü DB üzerinden yapılır.

const addSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().min(1).max(64),
  jobTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
});

// POST /api/admin/companies/members — üye ekle.
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

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Şirket ve kullanıcı bilgisi gerekli." },
        { status: 400 },
      );
    }

    const [company] = await getDb()
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.workspaceId, await getWorkspaceId()),
          eq(companies.id, parsed.data.companyId),
        ),
      );
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Şirket bulunamadı." },
        { status: 404 },
      );
    }

    const [user] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.userId));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı bulunamadı." },
        { status: 404 },
      );
    }

    const [existing] = await getDb()
      .select({ id: companyMembers.id })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, parsed.data.companyId),
          eq(companyMembers.userId, parsed.data.userId),
        ),
      );
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Bu kullanıcı bu şirkette zaten kayıtlı." },
        { status: 400 },
      );
    }

    const [created] = await getDb()
      .insert(companyMembers)
      .values({
        companyId: parsed.data.companyId,
        userId: parsed.data.userId,
        jobTitle: parsed.data.jobTitle,
      })
      .returning({ id: companyMembers.id });

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/companies/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üye eklenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  jobTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
});

// PATCH /api/admin/companies/members — ünvan güncelle.
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

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz üye verisi." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(companyMembers)
      .set({ jobTitle: parsed.data.jobTitle })
      .where(eq(companyMembers.id, parsed.data.id))
      .returning({ id: companyMembers.id });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Üye bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/companies/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üye güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/companies/members?id=... — üyeyi şirketten çıkar.
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
    const parsed = z.string().uuid().safeParse(rawId);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz üye kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(companyMembers)
      .where(eq(companyMembers.id, parsed.data))
      .returning({ id: companyMembers.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Üye bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/companies/members failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Üye çıkarılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
