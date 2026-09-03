import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { signWidgetToken } from "@/lib/widget/jwt";

// Admin token üreticisi (plan.md Sprint 32): "müşteri uygulaması" MVP'de
// adminin kendisi olduğu için test jetonu bu uçtan üretilir. Üretimde
// müşterinin kendi backend'i bu jetonu imzalar (dashboard/widget sayfasındaki
// Node.js örneği). Jeton 1 saat geçerlidir.

const TOKEN_TTL_SECONDS = 60 * 60;

const tokenRequestSchema = z.object({
  sub: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "Kimlik en fazla 64 karakter olmalı ve yalnızca harf, rakam, - ve _ içerebilir."),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().max(254).optional(),
});

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

    const parsed = tokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Kimlik bilgileri geçersiz." },
        { status: 400 },
      );
    }

    const token = signWidgetToken(
      {
        sub: parsed.data.sub,
        name: parsed.data.name || null,
        email: parsed.data.email || null,
      },
      TOKEN_TTL_SECONDS,
    );

    return NextResponse.json({
      success: true,
      data: { token, expiresIn: TOKEN_TTL_SECONDS },
    });
  } catch (err) {
    console.error(
      "POST /api/admin/widget-token failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Jeton üretilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
