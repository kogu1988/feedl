import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import { workspaceMembers, workspaces } from "./schema";

// 2026-09-12 (kullanıcı kararı — hesap düzeyi Pro).
//
// Workspace plan satırlarının tek kaynağı. İki tüketicisi var:
//   1) Workspace açma sınırı (`lib/db/workspace-limits.ts`) — Free = 1 workspace
//   2) Etkin plan çözümlemesi (`lib/paddle.ts`) — bu workspace'in owner'larından
//      birinin sahip olduğu BAŞKA bir workspace Pro ise bu workspace de Pro'dur.
//
// Bu modül BİLEREK `lib/paddle.ts`'ten import ETMEZ: `workspace-limits.ts`
// `effectivePlanKey` için paddle'a bağlı; burada paddle'a bağlanırsak döngü
// oluşur. Pencere/grace kararı çağıranın işidir.
export interface OwnedWorkspacePlanRow {
  id: string;
  plan?: string | null;
  paddleSubscriptionStatus?: string | null;
  paddleStatusChangedAt?: Date | string | null;
}

export async function loadOwnedWorkspacePlans(
  userId: string,
): Promise<OwnedWorkspacePlanRow[]> {
  return loadOwnedWorkspacePlansForUsers([userId]);
}

// Verilen kullanıcıların SAHİP OLDUĞU workspace'ler. Hesap düzeyi Pro
// çözümlemesi bir kullanıcı değil, workspace'in OWNER'ları üzerinden çalışır:
// böylece public sayfalar Clerk oturumu sormak zorunda kalmaz.
export async function loadOwnedWorkspacePlansForUsers(
  userIds: string[],
): Promise<OwnedWorkspacePlanRow[]> {
  if (userIds.length === 0) return [];
  return getDb()
    .select({
      id: workspaces.id,
      plan: workspaces.plan,
      paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        inArray(workspaceMembers.userId, userIds),
        eq(workspaceMembers.role, "owner"),
      ),
    );
}

// Bu workspace'in OWNER'larının sahip olduğu TÜM workspace'lerin plan satırları.
// TEK sorgu (self-join + alt sorgu): hesap düzeyi Pro kapısı her Free sayfa
// render'ında iki kez DB'ye gitmesin. Owner listesi boşsa sonuç da boştur.
export async function loadPlanRowsOwnedByWorkspaceOwners(
  workspaceId: string,
): Promise<OwnedWorkspacePlanRow[]> {
  const db = getDb();
  return db
    .selectDistinct({
      id: workspaces.id,
      plan: workspaces.plan,
      paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.role, "owner"),
        inArray(
          workspaceMembers.userId,
          db
            .select({ userId: workspaceMembers.userId })
            .from(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.workspaceId, workspaceId),
                eq(workspaceMembers.role, "owner"),
              ),
            ),
        ),
      ),
    );
}
