import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { changelogSubscribers } from "@/lib/db/schema";

// Sprint 40: changelog e-posta aboneliği. Middleware bu rotayı public
// tutar (middleware.ts) — anonim ziyaretçiler de abone olabilir.
// (workspace_id, email) unique: tekrar abonelik tek satırda kalır ve
// onConflictDoNothing ile "zaten abone" ayrımı yapılır.

const subscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .pipe(z.email("Geçerli bir e-posta adresi girin.")),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(`changelog-subscribe:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: "Çok fazla deneme. Lütfen biraz sonra tekrar dene." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
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

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçerli bir e-posta adresi girin." },
        { status: 400 },
      );
    }

    const inserted = await getDb()
      .insert(changelogSubscribers)
      .values({ workspaceId: await getWorkspaceId(), email: parsed.data.email })
      .onConflictDoNothing({
        target: [changelogSubscribers.workspaceId, changelogSubscribers.email],
      })
      .returning({ id: changelogSubscribers.id });

    return NextResponse.json({
      success: true,
      data: { alreadySubscribed: inserted.length === 0 },
    });
  } catch (err) {
    console.error(
      "POST /api/changelog/subscribe failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Abonelik kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
