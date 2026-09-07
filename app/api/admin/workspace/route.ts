import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { planFromString } from "@/lib/paddle";

// Sprint 48a (madde 8) — workspace ayarları. Tek workspace döneminde
// ad/marka/custom domain yönetimi; slug subdomain'in kaynağı olarak
// salt-okunur kalır (değiştirilemez — değişince tüm linkler kırılır).

const updateSchema = z.object({
  name: z.string().trim().min(1, "Workspace adı gerekli.").max(120).optional(),
  customDomain: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value ? value.replace(/\/$/, "").toLowerCase() : null)),
  brandColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Geçersiz renk. Örn: #ff5c35")
    .max(20)
    .nullable()
    .optional()
    .transform((value) => (value ? (value.startsWith("#") ? value : `#${value}`).toLowerCase() : null)),
  logoUrl: z
    .string()
    .trim()
    .url("Geçerli bir URL gerekli.")
    .max(500)
    .nullable()
    .optional(),
  // Sprint 63z: widget gönderim modu + anonim oyu (her plan için; widget
  // kurulumunda admin seçer).
  widgetSubmissionMode: z
    .enum(["anonymous", "email", "signup"])
    .optional(),
  widgetAnonymousVoting: z.boolean().optional(),
  // Sprint 59 (onboarding): dashboard checklist'ini kullanıcı "Şimdilik gizle"
  // derse null'a çekilecek; tamamlanınca otomatik gizlenir (kolon set edilmez).
  dismissOnboarding: z.literal(true).optional(),
});

// GET /api/admin/workspace — workspace bilgileri.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const [row] = await getDb()
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        customDomain: workspaces.customDomain,
        brandColor: workspaces.brandColor,
        logoUrl: workspaces.logoUrl,
        widgetSubmissionMode: workspaces.widgetSubmissionMode,
        widgetAnonymousVoting: workspaces.widgetAnonymousVoting,
      })
      .from(workspaces)
      .where(eq(workspaces.id, await getWorkspaceId()))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    console.error(
      "GET /api/admin/workspace failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace yüklenemedi." },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/workspace — workspace alanlarını güncelle.
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
        { success: false, error: "Workspace bilgileri geçersiz." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();

    // Sprint 63x — custom domain PRO özelliği. Free workspace custom domain
    // ayarlayamaz (yalnızca boşaltabilir/kaldırabilir). Plan, workspaces.plan
    // sütunundan türetilir (tek gerçek: lib/paddle planFromString).
    if (parsed.data.customDomain !== undefined && parsed.data.customDomain !== null) {
      const [row] = await getDb()
        .select({ plan: workspaces.plan })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
      if (planFromString(row?.plan) !== "pro") {
        return NextResponse.json(
          { success: false, error: "Custom domain yalnızca Pro planda. Pro'ya yükselt." },
          { status: 403 },
        );
      }
    }

    // En az bir alan güncellenmeli (slug asla değiştirilmez).
    const set: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) set.name = parsed.data.name;
    if (parsed.data.customDomain !== undefined)
      set.customDomain = parsed.data.customDomain;
    if (parsed.data.brandColor !== undefined)
      set.brandColor = parsed.data.brandColor;
    if (parsed.data.logoUrl !== undefined) set.logoUrl = parsed.data.logoUrl;
    if (parsed.data.widgetSubmissionMode !== undefined)
      set.widgetSubmissionMode = parsed.data.widgetSubmissionMode;
    if (parsed.data.widgetAnonymousVoting !== undefined)
      set.widgetAnonymousVoting = parsed.data.widgetAnonymousVoting;
    // Onboarding gizleme: dismissOnboarding=true → timestamp set, yalnızca gizleme.
    if (parsed.data.dismissOnboarding === true) {
      set.onboardingDismissedAt = new Date();
    }
    set.updatedAt = new Date();

    if (Object.keys(set).length <= 1 && set.updatedAt) {
      return NextResponse.json(
        { success: false, error: "Güncellenecek bir alan gerekli." },
        { status: 400 },
      );
    }

    const [updated] = await getDb()
      .update(workspaces)
      .set(set)
      .where(eq(workspaces.id, workspaceId))
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        customDomain: workspaces.customDomain,
        brandColor: workspaces.brandColor,
        logoUrl: workspaces.logoUrl,
        widgetSubmissionMode: workspaces.widgetSubmissionMode,
        widgetAnonymousVoting: workspaces.widgetAnonymousVoting,
      });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(
      "PATCH /api/admin/workspace failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace güncellenemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
