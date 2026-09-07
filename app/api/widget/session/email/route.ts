import { NextResponse, type NextRequest } from "next/server";
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
} from "@/lib/widget/jwt";
import { isOriginAllowed } from "@/lib/widget/origins";
import { requestOrigin } from "@/lib/widget/http";
import { enforceRateLimit, clientIpFrom } from "@/lib/rate-limit";

// Sprint 63z — email modu oturumu. "email" gönderim modundaki workspace'lerde
// kullanıcı üye olmadan SADECE e-posta adresini girerek fikir gönderir/oylar.
// Oturum email'den türetilir (deterministik widget_<email> kimliği), users'a
// upsert edilir ve 12 saatlik httpOnly çerez bırakılır. Email DOĞRULANMAZ
// (kullanıcı onayı: şimdilik yok, ileride eklenebilir).

const emailSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin.").max(254),
  workspace: z.string().trim().min(1).max(120).optional().nullable(),
});

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

// Workspace slug gerçekten varsa döndürür; yoksa null (varsayılana düşer).
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
  const origin = requestOrigin(req);
  const headers = await corsHeaders(origin);
  try {
    if (!isWidgetConfigured()) {
      return NextResponse.json(
        { success: false, error: "Widget yapılandırılmamış." },
        { status: 503, headers },
      );
    }
    if (!(await isOriginAllowed(origin))) {
      return NextResponse.json(
        { success: false, error: "Bu site için widget erişimi yok." },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit("widget:session:email", clientIpFrom(req), {
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
    const parsed = emailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz e-posta." },
        { status: 400, headers },
      );
    }

    const workspaceSlug = await resolveWorkspaceSlug(parsed.data.workspace);

    // Email'den deterministik widget kimliği; role her zaman customer (yükseltilmez).
    const userId = toWidgetUserId(parsed.data.email);
    await getDb()
      .insert(users)
      .values({
        id: userId,
        email: parsed.data.email,
        role: "customer",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: parsed.data.email, updatedAt: new Date() },
      });

    const token = signSessionToken(userId, origin, workspaceSlug);
    const response = NextResponse.json(
      { success: true, data: { userId, email: parsed.data.email } },
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
      "POST /api/widget/session/email failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Oturum açılamadı. Lütfen tekrar deneyin." },
      { status: 500, headers },
    );
  }
}
