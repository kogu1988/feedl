import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId, getOwnerUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import {
  DEFAULT_WORKSPACE_SLUG,
  getWorkspaceId,
} from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { effectivePlanKey } from "@/lib/paddle";
import {
  domainVerificationRecordName,
  domainVerificationRecordValue,
  generateDomainVerificationToken,
  isValidCustomDomain,
  normalizeCustomDomain,
} from "@/lib/custom-domain";

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
    // 2026-09-12: artık normalize + BİÇİM doğrulaması var. Eskiden yalnız
    // trim/lowercase yapılıyordu; herhangi bir string (path, boşluk, IP,
    // hatta feedl.app alt alanı) custom domain olarak kaydedilebiliyordu.
    .transform((value) =>
      value === undefined
        ? undefined
        : value
          ? normalizeCustomDomain(value)
          : null,
    )
    .refine(
      (value) => value === undefined || value === null || isValidCustomDomain(value),
      {
        message:
          "Geçerli bir alan adı gir (örn. feedback.acme.com — protokol ve path olmadan). feedl.app alt alan adları kullanılamaz.",
      },
    ),
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
        customDomainVerifiedAt: workspaces.customDomainVerifiedAt,
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

// Custom domain doğrulama bilgisi — API yanıtı ve arayüz TXT kaydını buradan alır.
export interface DomainVerificationInfo {
  domain: string;
  recordName: string;
  recordValue: string;
  verifiedAt: Date | null;
}

// Custom domain değişikliğini uygular (2026-09-12 kod incelemesi):
//  • teklik — aynı hostname'i başka bir workspace kaptıysa net 409,
//  • domain DEĞİŞTİYSE yeni TXT token'ı + doğrulamanın sıfırlanması,
//  • domain AYNI kaldıysa doğrulamanın korunması (yoksa her kaydetmede
//    kullanıcı yeniden DNS doğrulaması yapmak zorunda kalırdı).
// `set` nesnesini yerinde günceller.
async function applyCustomDomainChange(
  workspaceId: string,
  nextDomain: string | null,
  set: Record<string, unknown>,
): Promise<
  { ok: true; verification: DomainVerificationInfo | null } | { ok: false; message: string }
> {
  const [current] = await getDb()
    .select({
      domain: workspaces.customDomain,
      token: workspaces.customDomainVerificationToken,
      verifiedAt: workspaces.customDomainVerifiedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (nextDomain === null) {
    set.customDomain = null;
    set.customDomainVerificationToken = null;
    set.customDomainVerifiedAt = null;
    return { ok: true, verification: null };
  }

  if (nextDomain !== current?.domain) {
    const [taken] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.customDomain, nextDomain))
      .limit(1);
    if (taken && taken.id !== workspaceId) {
      return {
        ok: false,
        message: "Bu alan adı başka bir workspace tarafından kullanılıyor.",
      };
    }
    const token = generateDomainVerificationToken();
    set.customDomain = nextDomain;
    set.customDomainVerificationToken = token;
    set.customDomainVerifiedAt = null;
    return {
      ok: true,
      verification: {
        domain: nextDomain,
        recordName: domainVerificationRecordName(nextDomain),
        recordValue: domainVerificationRecordValue(token),
        verifiedAt: null,
      },
    };
  }

  // Domain aynı: doğrulama korunur. Token yoksa (eski satır) üret ve göster.
  const token = current?.token ?? generateDomainVerificationToken();
  if (!current?.token) set.customDomainVerificationToken = token;
  return {
    ok: true,
    verification: {
      domain: nextDomain,
      recordName: domainVerificationRecordName(nextDomain),
      recordValue: domainVerificationRecordValue(token),
      verifiedAt: current?.verifiedAt ?? null,
    },
  };
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
    // ayarlayamaz (yalnızca boşaltabilir/kaldırabilir). Plan çözümü tek
    // kaynaktan: lib/paddle effectivePlanKey (dunning grace dahil, denetim K3).
    if (parsed.data.customDomain !== undefined && parsed.data.customDomain !== null) {
      const [row] = await getDb()
        .select({
          plan: workspaces.plan,
          paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
          paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
        })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
      if (effectivePlanKey(row ?? {}) !== "pro") {
        return NextResponse.json(
          { success: false, error: "Custom domain yalnızca Pro planda. Pro'ya yükselt." },
          { status: 403 },
        );
      }
    }

    // En az bir alan güncellenmeli (slug asla değiştirilmez).
    const set: Record<string, unknown> = {};

    // 2026-09-12 — custom domain: biçim `updateSchema`'da doğrulandı; burada
    // teklik + sahiplik doğrulaması (TXT token) yönetilir.
    let domainVerification: DomainVerificationInfo | null = null;
    if (parsed.data.customDomain !== undefined) {
      const applied = await applyCustomDomainChange(
        workspaceId,
        parsed.data.customDomain,
        set,
      );
      if (!applied.ok) {
        return NextResponse.json(
          { success: false, error: applied.message },
          { status: 409 },
        );
      }
      domainVerification = applied.verification;
    }

    if (parsed.data.name !== undefined) set.name = parsed.data.name;
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
        customDomainVerifiedAt: workspaces.customDomainVerifiedAt,
      });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 404 },
      );
    }

    // `domainVerification`: arayüz TXT kaydını gösterebilsin (token zaten
    // kullanıcının kendi workspace'i için üretilir; sızıntı değildir).
    return NextResponse.json({
      success: true,
      data: { ...updated, domainVerification },
    });
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

// DELETE /api/admin/workspace — workspace'i ve TÜM verisini kalıcı olarak sil
// (denetim #8b; GDPR/KVKK silme hakkı).
//
// Yetki: OWNER-ONLY (geri dönüşü olmayan işlem).
// Onay: gövdede `confirm` = workspace slug'ı birebir eşleşmeli. Yanlışlıkla
// tetiklenmeye karşı arayüz "slug'ı yaz" ister; API de aynı kuralı uygular
// (arayüz atlatılsa bile kaza ile silme imkânsız).
//
// İki SERT engel vardır:
//  1) Varsayılan workspace (`feedl`) silinemez — host→workspace çözümlemesi bu
//     satıra düşer; silinirse feedl.app'in tamamı 500 olur.
//  2) Etkin Pro abonelik varsa silinemez — aksi halde Paddle aboneliği
//     workspace'siz kalır ve müşteri, ürünü olmayan bir şey için ödeme yapmaya
//     devam eder. Önce /dashboard/billing üzerinden iptal edilmelidir.
//
// Silme tek satırdır: şemadaki tüm workspace-kapsamlı tablolar
// `onDelete: "cascade"` taşıdığından alt kayıtlar DB tarafından temizlenir.
const deleteSchema = z.object({
  confirm: z.string().trim().min(1, "Onay için workspace adresi (slug) gerekli."),
});

// Onboarding bu çerezi set eder (app/api/onboarding/route.ts) — silinen
// workspace'e işaret etmesin diye burada temizlenir.
const ACTIVE_WS_COOKIE = "feedl_active_ws";

export async function DELETE(req: Request) {
  try {
    const ownerId = await getOwnerUserId();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için workspace sahibi (owner) yetkisi gerekir." },
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
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Onay bilgisi geçersiz." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        plan: workspaces.plan,
        paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
        paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 404 },
      );
    }

    if (row.slug === DEFAULT_WORKSPACE_SLUG) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Varsayılan workspace silinemez; feedl.app bu workspace'e bağlıdır. Bunun yerine verilerini temizlememizi isteyebilirsin.",
        },
        { status: 409 },
      );
    }

    if (parsed.data.confirm !== row.slug) {
      return NextResponse.json(
        { success: false, error: "Onay adresi workspace adresiyle eşleşmiyor." },
        { status: 400 },
      );
    }

    if (effectivePlanKey(row) === "pro") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Etkin bir Pro abonelik var. Önce /dashboard/billing sayfasından aboneliği iptal et, sonra workspace'i sil.",
        },
        { status: 409 },
      );
    }

    await getDb().delete(workspaces).where(eq(workspaces.id, workspaceId));

    // Aktif workspace çerezi artık var olmayan bir slug'ı gösteriyor olabilir;
    // temizlenmezse bir sonraki istek onu arar, bulamaz ve host'a düşer
    // (doğru davranış ama gereksiz bir sorgu).
    const response = NextResponse.json({
      success: true,
      data: { deletedWorkspaceId: row.id, slug: row.slug },
    });
    response.cookies.delete(ACTIVE_WS_COOKIE);

    console.warn(
      `[workspace-delete] slug=${row.slug} id=${row.id} by=${ownerId}`,
    );

    return response;
  } catch (err) {
    console.error(
      "DELETE /api/admin/workspace failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace silinemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
