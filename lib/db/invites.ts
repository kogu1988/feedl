import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { users, workspaceInvites, workspaceMembers } from "./schema";
import type { WorkspaceMemberRole } from "./membership";

// Sprint 48j (madde 8, P1) — davet akışı. Tek kullanımlık, süreli token;
// kabul edilince workspace_members'e üye eklenir. PII: davet linki token
// redaksiyonlu; rate limit ve audit API katmanında.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createInvite(
  email: string,
  role: WorkspaceMemberRole,
  createdBy: string,
) {
  const workspaceId = await getWorkspaceId();
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const [created] = await getDb()
    .insert(workspaceInvites)
    .values({ workspaceId, email: email.toLowerCase(), role, token, expiresAt, createdBy })
    .returning();
  return created;
}

// Token ile geçersiz kılmamış (acceptedAt null), süresi dolmamış daveti getir.
export async function findValidInvite(token: string) {
  const [row] = await getDb()
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.token, token), isNull(workspaceInvites.acceptedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await findValidInvite(token);
  if (!invite) {
    return { ok: false as const, error: "Davet geçersiz veya süresi dolmuş." };
  }
  // Kullanıcının e-postası davet e-postasıyla eşleşmeli (Clerk girişi).
  const [user] = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { ok: false as const, error: "Bu davet farklı bir e-posta için." };
  }
  // Üye ekle (zaten varsa rol güncelle), daveti kabul işaretle. İki işlem
  // tek akış; neon-http transaction'sız — sıralı (davet kabulü üye insert'i
  // başarısızsa açık kalır, tekrar deneme güvenli).
  await getDb()
    .insert(workspaceMembers)
    .values({ workspaceId: invite.workspaceId, userId, role: invite.role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role: invite.role, updatedAt: new Date() },
    });
  await getDb()
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id));
  return { ok: true as const, workspaceId: invite.workspaceId };
}

export async function listWorkspaceInvites() {
  return getDb()
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
      createdAt: workspaceInvites.createdAt,
    })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, await getWorkspaceId()))
    .orderBy(workspaceInvites.createdAt);
}
