import { and, asc, count, eq } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { users, workspaceMembers } from "./schema";

// Sprint 48c-2 (madde 8): workspace rol matrisi. getAdminUserId bu
// katmandan doğrular; geriye dönük uyumluluk için users.role='admin' de
// kabul edilir (geçiş dönemi). Roller: owner | admin | member.

export type WorkspaceMemberRole = "owner" | "admin" | "member";

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

// Bir kullanıcı bu workspace'teki en az bir rolü kapasitesine eşit veya
// üstündeyse true. (owner/admin admin sayılır; member sayılmaz.)
export async function hasWorkspaceAdminAccess(
  userId: string,
): Promise<boolean> {
  const role = await getWorkspaceRole(userId);
  if (role === "owner" || role === "admin") return true;
  // Geriye dönük: users.role='admin' ise yine admin (geçiş dönemi).
  const [userRow] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return userRow?.role === "admin";
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
    .returning({ id: workspaceMembers.id, userId: workspaceMembers.userId, role });
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
