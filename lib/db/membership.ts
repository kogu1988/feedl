import { and, asc, count, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { users, workspaceMembers } from "./schema";

// Sprint 48c-2 (madde 8): workspace rol matrisi. Roller: owner | admin |
// member | contributor.
//
// ROL AYRIMI (2026-09-10, kullanıcı kararı): workspace yetkisinin TEK kaynağı
// burasıdır (workspace_members). `users.role='admin'` artık feedl PLATFORM
// personelini işaret eder (kendi iç admin panelimiz için ayrılmıştır) ve
// workspace yetkisi VERMEZ. Dashboard'da en yetkili kademe owner'dır.

export type WorkspaceMemberRole = "owner" | "admin" | "member" | "contributor";

export async function getWorkspaceRole(
  userId: string,
): Promise<WorkspaceMemberRole | null> {
  const [row] = await getDb()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, await getWorkspaceId()),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

// Bir kullanıcı bu workspace'te yönetici mi? (owner/admin)
// Platform personeli (`users.role='admin'`) workspace yetkisi KAZANMAZ —
// yetki yalnız üyelikten gelir.
export async function hasWorkspaceAdminAccess(
  userId: string,
): Promise<boolean> {
  const role = await getWorkspaceRole(userId);
  return role === "owner" || role === "admin";
}

// Workspace ekibi (owner/admin/contributor) — portal son kullanıcıları
// (member) hariç. Bildirim alıcıları ve yol haritası "sorumlu" seçimi bu
// listeyi kullanır; açık workspaceId alır (Inngest/istek dışı bağlamlarda
// getWorkspaceId() çözülemez).
export async function listWorkspaceTeam(workspaceId: string) {
  return getDb()
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      name: users.name,
      email: users.email,
      emailDigest: users.emailDigest,
      unsubscribeToken: users.unsubscribeToken,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        inArray(workspaceMembers.role, ["owner", "admin", "contributor"]),
      ),
    )
    .orderBy(asc(workspaceMembers.createdAt));
}

export async function listWorkspaceMembers() {
  return getDb()
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, await getWorkspaceId()))
    .orderBy(asc(workspaceMembers.createdAt));
}

// Üye ekle/güncelle — role, önceki role'den düşükse reddedilir (owner
// sınırı: en az bir owner kalmalı uygulama katmanında; burada tekil rol yazılır).
export async function upsertWorkspaceMember(
  userId: string,
  role: WorkspaceMemberRole,
) {
  const workspaceId = await getWorkspaceId();
  return getDb()
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role, updatedAt: new Date() },
    })
    .returning({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
    });
}

export async function removeWorkspaceMember(userId: string) {
  // Son owner kaldırılamaz — en az bir owner olmalı.
  const [ownerRow] = await getDb()
    .select({ value: count(workspaceMembers.id) })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, await getWorkspaceId()),
        eq(workspaceMembers.role, "owner"),
      ),
    );
  const currentRole = await getWorkspaceRole(userId);
  if (currentRole === "owner" && ownerRow && Number(ownerRow.value) <= 1) {
    throw new Error("En az bir workspace sahibi (owner) kalmalı.");
  }
  await getDb()
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, await getWorkspaceId()),
        eq(workspaceMembers.userId, userId),
      ),
    );
}
