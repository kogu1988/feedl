import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { workspaceMembers, workspaces } from "./schema";

// 2026-09-12 (kullanıcı kararı — hesap düzeyi Pro).
//
// Kullanıcının SAHİP OLDUĞU workspace'lerin plan satırları. İki yerde kullanılır:
//   1) Workspace açma sınırı (`lib/db/workspace-limits.ts`) — Free = 1 workspace
//   2) Etkin plan çözümlemesi (`lib/paddle.ts`) — sahibi olduğun bir workspace
//      Pro ise, sahibi olduğun TÜM workspace'lerde Pro'sun.
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
      and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")),
    );
}
