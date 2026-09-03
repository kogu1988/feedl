import "server-only";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { companies, opportunities } from "@/lib/db/schema";

// Sprint 31 — satış fırsatı yönetimi (P3.2). Fırsatlar şirkete bağlı;
// şirket silinince cascade gider. Fikirle bağı links route'undan kurulur.
// Gelir skoru yalnızca açık aşamaları (open/proposal) sayar.

const stageSchema = z.enum(["open", "proposal", "won", "lost"]);

const opportunityInputSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(1, "Fırsat başlığı gerekli.").max(160),
  dealValue: z.number().min(0).max(99999999.99).nullable().optional(),
  stage: stageSchema.optional(),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG formatında olmalı.")
    .optional()
    .transform((value) => (value ? value : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
});

// GET /api/admin/opportunities — fırsatlar + şirket adı (fikir detayındaki
// bağlama listesi ve Şirketler sayfası aynı veriyi kullanır).
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
        id: opportunities.id,
        companyId: opportunities.companyId,
        companyName: companies.name,
        title: opportunities.title,
        dealValue: opportunities.dealValue,
        stage: opportunities.stage,
        expectedCloseDate: opportunities.expectedCloseDate,
        notes: opportunities.notes,
      })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .orderBy(desc(opportunities.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error(
      "GET /api/admin/opportunities failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fırsatlar yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/opportunities — yeni fırsat.
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

    const parsed = opportunityInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Fırsat başlığı 1-160 karakter olmalı." },
        { status: 400 },
      );
    }

    const [created] = await getDb()
      .insert(opportunities)
      .values({
        companyId: parsed.data.companyId,
        title: parsed.data.title,
        dealValue:
          parsed.data.dealValue == null ? "0" : String(parsed.data.dealValue),
        stage: parsed.data.stage ?? "open",
        expectedCloseDate: parsed.data.expectedCloseDate,
        notes: parsed.data.notes,
      })
      .returning({ id: opportunities.id });

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "POST /api/admin/opportunities failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fırsat oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/opportunities — fırsat alanlarını güncelle.
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

    const parsed = opportunityInputSchema
      .extend({ id: z.string().uuid() })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz fırsat verisi." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(opportunities)
      .set({
        companyId: parsed.data.companyId,
        title: parsed.data.title,
        dealValue:
          parsed.data.dealValue == null ? "0" : String(parsed.data.dealValue),
        stage: parsed.data.stage ?? "open",
        expectedCloseDate: parsed.data.expectedCloseDate,
        notes: parsed.data.notes,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, parsed.data.id))
      .returning({ id: opportunities.id });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Fırsat bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/opportunities failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fırsat güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/opportunities?id=... — fırsatı sil (fikir bağları cascade).
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
        { success: false, error: "Geçersiz fırsat kimliği." },
        { status: 400 },
      );
    }

    const [deleted] = await getDb()
      .delete(opportunities)
      .where(eq(opportunities.id, parsed.data))
      .returning({ id: opportunities.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Fırsat bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    console.error(
      "DELETE /api/admin/opportunities failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Fırsat silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
