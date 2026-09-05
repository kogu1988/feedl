import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces, users } from "@/lib/db/schema";
import { createInvite, listWorkspaceInvites } from "@/lib/db/invites";
import { renderInviteEmail } from "@/lib/email/invite";
import { sendEmails } from "@/lib/email/send";
import { enforceLimit } from "@/lib/paddle";
import {
  listWorkspaceMembers,
  type WorkspaceMemberRole,
} from "@/lib/db/membership";

// Sprint 48j (madde 8, P1) — davet akışı. Var olan kullanıcı değil, e-posta
// ile davet et; token'lı mail. Üye limiti enforceLimit ile.

const inviteSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta gerekli.").max(200),
  role: z.enum(["owner", "admin", "member", "contributor"]).default("member"),
});

// GET /api/admin/invites — bekleyen/geçmiş davetler.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const rows = await listWorkspaceInvites();
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/admin/invites failed:", err);
    return NextResponse.json(
      { success: false, error: "Davetler yüklenemedi." },
      { status: 500 },
    );
  }
}

// POST /api/admin/invites — davet oluştur + mail gönder.
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
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "E-posta ve rol geçersiz." },
        { status: 400 },
      );
    }

    // Üye limiti: davet edilecek kişi zaten üye değilse sayılır.
    const existingMembers = await listWorkspaceMembers();
    const memberCheck = await enforceLimit("member", existingMembers.length);
    if (!memberCheck.ok) {
      return NextResponse.json(
        { success: false, error: memberCheck.message },
        { status: 403 },
      );
    }

    // Workspace + davet eden kişinin adı (mail için).
    const [workspace] = await getDb()
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, await getWorkspaceId()))
      .limit(1);
    const [inviter] = await getDb()
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    const invite = await createInvite(
      parsed.data.email,
      parsed.data.role as WorkspaceMemberRole,
      adminId,
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
    const message = renderInviteEmail({
      inviterName: inviter?.name ?? inviter?.email ?? "Bir yönetici",
      workspaceName: workspace?.name ?? "feedl",
      inviteUrl: `${appUrl}/invites/accept?token=${invite.token}`,
    });
    await sendEmails([
      { to: parsed.data.email, subject: message.subject, html: message.html, text: message.text },
    ]);

    return NextResponse.json({ success: true, data: invite }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/invites failed:", err);
    return NextResponse.json(
      { success: false, error: "Davet gönderilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
