import "server-only";

import { and, eq } from "drizzle-orm";

import { effectivePlanKey } from "@/lib/paddle";
import { getDb } from "./index";
import { workspaceMembers, workspaces } from "./schema";

// 2026-09-12 (kullanıcı kararı) — WORKSPACE SAYISI SINIRI.
//
// BOŞLUK: `POST /api/admin/workspaces` hiçbir sınır koymuyordu ve yeni
// workspace şema varsayılanıyla `free` doğuyordu. Plan limitleri WORKSPACE
// BAŞINA olduğu için bir Free kullanıcı sınırsız workspace açıp her birinde 1
// bedava board + kendi portalını + kendi subdomain'ini alabiliyordu; yani
// "Pro = sınırsız board" taahhüdü dolanılabiliyordu (gelir kaçağı).
//
// KURAL: Free hesap 1 workspace'e sahip olabilir; Pro'da sınır yok.
// "Free hesap" = kullanıcının SAHİP OLDUĞU workspace'lerin HİÇBİRİ etkin Pro
// değilse. Böylece herhangi bir workspace'te ödeme yapan müşteri ek workspace
// açabilir (o zaten müşteridir), bedava kullanıcı tek workspace'te kalır.
//
// Ölçüm "owner" üyeliği üzerindendir: kullanıcı başkasının workspace'inde
// manager/member olabilir; bu onun KENDİ workspace sayısını artırmaz.

export type WorkspaceCreationDecision = "ok" | "free_limit";

export const FREE_WORKSPACE_LIMIT_MESSAGE =
  "Free plan 1 workspace ile sınırlıdır. Yeni bir workspace açmak için Pro'ya geç.";

export interface OwnedWorkspacePlan {
  plan?: string | null;
  paddleSubscriptionStatus?: string | null;
  paddleStatusChangedAt?: Date | string | null;
}

// SAF karar fonksiyonu (DB'siz, test edilebilir). Dunning grace dahil:
// `effectivePlanKey` "ödemesi geciken ama penceresi dolmamış" workspace'i
// Pro sayar — müşteri kartı düzeltirken workspace açma hakkını kaybetmez.
export function decideWorkspaceCreation(
  owned: OwnedWorkspacePlan[],
): WorkspaceCreationDecision {
  if (owned.length === 0) return "ok";
  return owned.some((ws) => effectivePlanKey(ws) === "pro") ? "ok" : "free_limit";
}

// Kullanıcının SAHİP OLDUĞU workspace'ler (limit kararının girdisi).
export async function loadOwnedWorkspaces(userId: string) {
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

// API ve arayüzün paylaştığı tek karar noktası.
export async function loadWorkspaceCreationAllowance(
  userId: string,
): Promise<{
  allowed: boolean;
  reason: WorkspaceCreationDecision;
  ownedCount: number;
}> {
  const owned = await loadOwnedWorkspaces(userId);
  const reason = decideWorkspaceCreation(owned);
  return { allowed: reason === "ok", reason, ownedCount: owned.length };
}
