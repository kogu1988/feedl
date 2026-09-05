import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { acceptInvite } from "@/lib/db/invites";

// Sprint 48j — davet kabul. Girişli kullanıcı token'ı ile üye olur; üye
// ekleme davet e-postasıyla eşleşmeli. POST (fetch'ten) — sayfa /invites/accept.
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Önce giriş yapmalısın." },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim();
    if (!token || !z.string().min(1).safeParse(token).success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz davet." },
        { status: 400 },
      );
    }

    const result = await acceptInvite(token, userId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: { workspaceId: result.workspaceId } });
  } catch (err) {
    console.error("POST /api/invites/accept failed:", err);
    return NextResponse.json(
      { success: false, error: "Davet kabul edilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
