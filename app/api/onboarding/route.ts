import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { workspaces, boards, workspaceMembers } from "@/lib/db/schema";

// Sprint 63 (onboarding wizard) — self-serve ilk workspace oluşturma. Yeni
// kaydolan kullanıcı (henüz admin değil) kendi workspace + varsayılan board'ını
// oluşturur; oluşturan kişi owner olur. `feedl_active_ws` çerezi set edilir →
// getWorkspaceId o workspace'i aktif sayar (kullanıcı ona "girer").

const ACTIVE_WS_COOKIE = "feedl_active_ws";

const slugRegex = /^[a-z0-9][a-z0-9-]{1,62}$/;

const createSchema = z.object({
  name: z.string().trim().min(2, "Workspace adı en az 2 karakter olmalı.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Slug yalnızca küçük harf, rakam ve tire içerebilir (2-63).")
    .optional()
    .or(z.string().trim().length(0).transform(() => undefined)),
});

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

// Kullanıcının bu workspace'te üyeliği var mı?
async function userHasWorkspace(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  return Boolean(row);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
      );
    }

    // Zaten bir workspace üyeliği varsa onCreate (çoklu onboard engellenir).
    if (await userHasWorkspace(userId)) {
      return NextResponse.json(
        { success: false, error: "Zaten bir workspace'e bağlısın." },
        { status: 409 },
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
        { success: false, error: "Workspace adı geçersiz (en az 2 karakter)." },
        { status: 400 },
      );
    }
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
        .values({
          name: parsed.data.name,
          slug: wsSlug,
          // Onboarding her zaman FREE plan ile başlar (Faz 5 kararı). Schema
          // default'ları zaten free (free: 1 board, 1 üye, 50 takipçi); burada
          // açıkça yazmak intent'i ve limit kontrolünün tabanını belgeler.
          plan: "free",
          memberLimit: 1,
          boardLimit: 1,
          trackedUserLimit: 50,
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          plan: workspaces.plan,
          memberLimit: workspaces.memberLimit,
          boardLimit: workspaces.boardLimit,
          trackedUserLimit: workspaces.trackedUserLimit,
        });

      // Sprint 63 (rev., madde limit kontrolü): free tier her zaman 1 board +
      // 1 owner (üye) oluşturmaya izin verir. Yine de oluşturulan kaynak
      // sayıları workspace'in kendi limitlerine sığıyor mu doğrula — plan
      // limiti misconfigure ise (örn. 0) baştan reddet, sessizce aşma.
      if (created.boardLimit < 1 || created.memberLimit < 1) {
        throw new Error(
          `Board/üye limiti çok düşük (board=${created.boardLimit}, üye=${created.memberLimit}).`,
        );
      }

      // Varsayılan board + owner (aynı workspace). Board sayısı 1 ≤ boardLimit,
      // üye sayısı 1 ≤ memberLimit (yeni workspace boş başlar).
      await getDb().insert(boards).values({
        workspaceId: created.id,
        name: "Genel",
        slug: "genel",
        visibility: "public",
        sortOrder: 0,
      });
      await getDb()
        .insert(workspaceMembers)
        .values({ workspaceId: created.id, userId, role: "owner" });

      // Aktif workspace çerezi → getWorkspaceId bu workspace'i kullanır.
      const response = NextResponse.json(
        { success: true, data: created },
        { status: 201 },
      );
      response.cookies.set(ACTIVE_WS_COOKIE, created.slug, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 gün
      });
      return response;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json(
          { success: false, error: "Bu slug zaten kullanımda; farklı bir ad/şablon dene." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    console.error(
      "POST /api/onboarding failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Workspace oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
