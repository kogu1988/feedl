import "server-only";

import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { companies, companyMembers, users } from "@/lib/db/schema";

// Sprint 30 — müşteri şirket yönetimi (P3.1). Üyeler cascade silinir;
// şirketin fikirlerle bağı Sprint 31'de opportunities üzerinden gelir.

const companyInputSchema = z.object({
  name: z.string().trim().min(1, "Şirket adı gerekli.").max(120),
  domain: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : null)),
  mrr: z.number().min(0).max(99999999.99).nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
});

// GET /api/admin/companies — şirketler + üye listeleri (tek istekle yönetim
// ekranı verisi; fan-out yok, üyeler ikinci sorgudan JS'te gruplanır).
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const companyRows = await getDb()
      .select()
      .from(companies)
      .orderBy(asc(companies.name));

    const memberRows = await getDb()
      .select({
        id: companyMembers.id,
        companyId: companyMembers.companyId,
        userId: companyMembers.userId,
        jobTitle: companyMembers.jobTitle,
        userName: users.name,
        userEmail: users.email,
      })
      .from(companyMembers)
      .innerJoin(users, eq(users.id, companyMembers.userId))
      .orderBy(asc(users.name));

    const membersByCompany = new Map<string, typeof memberRows>();
    for (const member of memberRows) {
      const list = membersByCompany.get(member.companyId) ?? [];
      list.push(member);
      membersByCompany.set(member.companyId, list);
    }

    const data = companyRows.map((company) => ({
      id: company.id,
      name: company.name,
      domain: company.domain,
      mrr: company.mrr,
      notes: company.notes,
      members: (membersByCompany.get(company.id) ?? []).map((member) => ({
        id: member.id,
        userId: member.userId,
        jobTitle: member.jobTitle,
        userName: member.userName ?? member.userEmail,
        userEmail: member.userEmail,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error(
      "GET /api/admin/companies failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Şirketler yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/companies — yeni şirket.
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

    const parsed = companyInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Şirket adı 1-120 karakter olmalı." },
        { status: 400 },
      );
    }

    const [created] = await getDb()
      .insert(companies)
      .values({
        workspaceId: await getWorkspaceId(),
        name: parsed.data.name,
        domain: parsed.data.domain,
        mrr: parsed.data.mrr == null ? null : String(parsed.data.mrr),
        notes: parsed.data.notes,
      })
      .returning({ id: companies.id });

    return NextResponse.json(
      { success: true, data: { id: created.id } },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/companies failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Şirket oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/companies — şirket alanlarını güncelle.
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

    const parsed = companyInputSchema
      .extend({ id: z.string().uuid() })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz şirket verisi." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(companies)
      .set({
        name: parsed.data.name,
        domain: parsed.data.domain,
        mrr: parsed.data.mrr == null ? null : String(parsed.data.mrr),
        notes: parsed.data.notes,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, parsed.data.id))
      .returning({ id: companies.id });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Şirket bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/companies failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Şirket güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/companies?id=... — şirketi sil (üyeler cascade).
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
        { success: false, error: "Geçersiz şirket kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(companies)
      .where(eq(companies.id, parsed.data))
      .returning({ id: companies.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Şirket bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/companies failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Şirket silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
