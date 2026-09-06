import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import {
  SESSION_TTL_SECONDS,
  WIDGET_SESSION_COOKIE,
  isWidgetConfigured,
  signSessionToken,
  toWidgetUserId,
  verifyWidgetToken,
} from "@/lib/widget/jwt";
import { isOriginAllowed } from "@/lib/widget/origins";
import { requestOrigin } from "@/lib/widget/http";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";

// Widget oturumu (plan.md Sprint 32): müşteri uygulaması imzaladığı kısa
// ömürlü JWT'yi parent sayfadan buraya gönderir; feedl widget kullanıcısını
// users tablosuna upsert eder ve 12 saatlik httpOnly çerez bırakır.
// İframe içi istekler (posts/votes) kimliği bu çerezden çözer.
//
// CORS: çağrı parent siteden geldiği için cross-origin'dir — allowlist'i
// geçen origin'e yansıtılır; aksi halde tarayıcı yanıtı bloklar.

async function corsHeaders(origin: string | null): Promise<Record<string, string>> {
  if (!origin || !(await isOriginAllowed(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = requestOrigin(req);
  const headers = await corsHeaders(origin);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...headers,
      ...(headers["Access-Control-Allow-Origin"]
        ? {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "600",
          }
        : {}),
    },
  });
}

const sessionSchema = z.object({
  token: z.string().min(1, "Jeton gerekli.").max(4096, "Jeton çok uzun."),
  // Sprint 63p — widget tenant-aware: müşteri sitesi hangi workspace'e ait?
  // `data-feedl-workspace="acme"` ile sağlanır (slug). Verilmezse varsayılan.
  workspace: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .nullable(),
});

// Workspace slug gerçekten varsa döndürür, yoksa null (varsayılana düşer).
async function resolveWorkspaceSlug(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const [row] = await getDb()
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return row?.slug ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const origin = requestOrigin(req);
    const headers = await corsHeaders(origin);

    if (!isWidgetConfigured()) {
      return NextResponse.json(
        { success: false, error: "Widget yapılandırılmamış." },
        { status: 503, headers },
      );
    }
    if (!(await isOriginAllowed(origin))) {
      // Bu origin için CORS başlıkları YOK: tarayıcı yanıtı okuyamaz.
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
        { status: 403 },
      );
    }

    // Sprint 60: widget oturum oluşturma — IP bazlı (session çiftliği önler).
    const rl = await enforceRateLimit("widget:session", clientIpFrom(req), {
      limit: 30,
    });
    if (!rl.allowed) return rl.response!;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400, headers },
      );
    }

    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400, headers },
      );
    }

    const identity = verifyWidgetToken(parsed.data.token);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: "Widget jetonu geçersiz veya süresi dolmuş." },
        { status: 401, headers },
      );
    }

    // Sprint 63p: workspace slug'ı doğrula (varsa gerçekten bir workspace'e
    // ait olmalı) — session JWT'ye gömülür, iframe istekleri bunu kullanır.
    const workspaceSlug = await resolveWorkspaceSlug(parsed.data.workspace);

    // posts.userId FK users.id NOT NULL — widget kullanıcısı kayıt edilmeden
    // fikir/oy yazılamaz. Email yoksa sentezlenir; role asla yükseltilmez.
    const userId = toWidgetUserId(identity.sub);
    await getDb()
      .insert(users)
      .values({
        id: userId,
        email: identity.email ?? `${identity.sub}@widget.feedl.local`,
        name: identity.name,
        role: "customer",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: identity.name,
          ...(identity.email ? { email: identity.email } : {}),
          updatedAt: new Date(),
        },
      });

    const token = signSessionToken(userId, origin, workspaceSlug);
    const response = NextResponse.json(
      { success: true, data: { userId, name: identity.name } },
      { headers },
    );
    response.cookies.set({
      name: WIDGET_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (err) {
    console.error(
      "POST /api/widget/session failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Widget oturumu açılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
