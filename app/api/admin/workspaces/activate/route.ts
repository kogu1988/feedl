import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { workspaceMembers, workspaces } from "@/lib/db/schema";

// 2026-09-12 (kullanıcı) — WORKSPACE SEÇİMİ.
//
// BOŞLUK: `feedl_active_ws` çerezi yalnız onboarding'de set ediliyordu; "mevcut
// workspace" host'a göre çözülüyordu (feedl.app → varsayılan `feedl`). Çoklu
// workspace sahibi, sayfadaki Ayarlar/Sil bölümünün HANGİ workspace'i
// hedeflediğini seçemiyordu — "hangi workspace'i nasıl sileceğim?" sorusunun
// arayüzde cevabı yoktu.
//
// YETKİ: oturum sahibi kullanıcı, HEDEF workspace'te üye olmalıdır. Burada
// `getAdminUserId()` BİLİNÇLİ olarak KULLANILMAZ: o, MEVCUT workspace'teki role
// bakar; hedefte üye olan ama mevcutta olmayan bir kullanıcı hiç geçiş
// yapamazdı. Doğru kontrol hedefteki üyeliktir.
//
// Çerez bir YETKİ BARIYERİ DEĞİLDİR (bkz. lib/db/workspace.ts güvenlik notu):
// yalnız hangi workspace bağlamında çalışılacağını seçen routing ipucudur.
// Yetki her istekte üyelikten yeniden doğrulanır; bu yüzden burada rol şartı
// aranmaz — üyelik (owner/manager/member) yeterlidir.

const bodySchema = z.object({
  workspaceId: z.string().uuid("Geçersiz workspace."),
});

// Onboarding ile AYNI çerez adı ve bayrakları (tek davranış).
const ACTIVE_WS_COOKIE = "feedl_active_ws";

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Giriş yapmalısın." },
        { status: 401 },
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
        { success: false, error: "Workspace belirtilmedi." },
        { status: 400 },
      );
    }

    const [membership] = await getDb()
      .select({ slug: workspaces.slug })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, parsed.data.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Bu workspace'e erişim yetkin yok." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      success: true,
      data: { slug: membership.slug },
    });
    response.cookies.set(ACTIVE_WS_COOKIE, membership.slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 gün
    });
    return response;
  } catch (err) {
    console.error(
      "POST /api/admin/workspaces/activate failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace değiştirilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
