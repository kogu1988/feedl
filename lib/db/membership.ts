import { and, asc, count, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { users, workspaceMembers } from "./schema";

// Sprint 48c-2 (madde 8) + 2026-09-11 (3 kademe, kullanıcı kararı) —
// workspace rol matrisi. Roller: **owner | manager | member**.
//
// ROL AYRIMI: workspace yetkisinin TEK kaynağı burasıdır (workspace_members).
// `users.role='admin'` feedl PLATFORM personelini işaret eder (kendi iç admin
// panelimiz için ayrılmıştır) ve workspace yetkisi VERMEZ.
//
//   owner   → her şey (billing, workspace silme, üye ve owner yönetimi)
//   manager → ürün ops + üye yönetimi; BILLING HARİÇ
//   member  → ürün ops (fikir/yorum/durum/roadmap); ayarlar/billing/gelir hariç
//
// "user" (yetkisiz düz kullanıcı) SAKLANAN bir rol DEĞİLDİR: `workspace_members`
// satırı olmamasıdır (yalnız public portal + widget). Anonim widget
// kullanıcıları (`widget_anon_*`) da bu kategoridedir.
//
// Rol workspace'e ÖZELDİR (workspaceId, userId çifti): aynı kişi bir
// workspace'te owner, başka birinde member olabilir.
//
// 2026-09-11 göçü: eski `admin` → `manager`, eski `contributor` → `member`.
// Eski `member` (portal son kullanıcısı) satırları silindi — davranışları
// değişmez (zaten yalnız portal erişimleri vardı).

export type WorkspaceMemberRole = "owner" | "manager" | "member";

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

// Bu workspace'te yönetim yetkisi (owner/manager) var mı? Üye listesi, üye
// daveti, gelir raporu, entegrasyonlar bu kademeyi gerektirir.
// Platform personeli (`users.role='admin'`) workspace yetkisi KAZANMAZ —
// yetki yalnız üyelikten gelir.
export async function hasWorkspaceAdminAccess(
  userId: string,
): Promise<boolean> {
  const role = await getWorkspaceRole(userId);
  return role === "owner" || role === "manager";
}

// Yalnız owner mı? (faturalandırma + workspace silme + owner atama/devri).
// "owner = ürünü satın alan" kararı gereği billing bu kademeye kilitlidir.
export async function isWorkspaceOwner(userId: string): Promise<boolean> {
  return (await getWorkspaceRole(userId)) === "owner";
}

// Workspace EKİBİ (owner/manager/member) — portal son kullanıcıları (üyeliği
// olmayanlar) hariç. Bildirim alıcıları ve yol haritası "sorumlu" seçimi bu
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
        inArray(workspaceMembers.role, ["owner", "manager", "member"]),
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

async function countOwners(workspaceId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count(workspaceMembers.id) })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
      ),
    );
  return Number(row?.value ?? 0);
}

// Workspace her zaman en az bir owner'a sahip olmalı. Owner devri (yeni owner
// ata, sonra kendini düşür) bu kuralı ihlal etmez — sıra önemli.
async function assertNotLastOwner(workspaceId: string): Promise<void> {
  if ((await countOwners(workspaceId)) <= 1) {
    throw new Error("En az bir workspace sahibi (owner) kalmalı.");
  }
}

// Üye ekle/güncelle. Son owner'ı düşürmek reddedilir (owner sınırı).
export async function upsertWorkspaceMember(
  userId: string,
  role: WorkspaceMemberRole,
) {
  const workspaceId = await getWorkspaceId();
  const currentRole = await getWorkspaceRole(userId);
  if (currentRole === "owner" && role !== "owner") {
    await assertNotLastOwner(workspaceId);
  }
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
  const workspaceId = await getWorkspaceId();
  if ((await getWorkspaceRole(userId)) === "owner") {
    await assertNotLastOwner(workspaceId);
  }
  await getDb()
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    );
}
