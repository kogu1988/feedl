import { and, countDistinct, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { companies, companyMembers, votes } from "./schema";

// Sprint 30: bir fikre oy veren kullanıcıların bağlı olduğu şirket
// sayısı (Canny'nin "kaç müşteri istedi" sayacı). Aynı şirketten birden çok
// kullanıcı oy verse de şirket bir kez sayılır (countDistinct). Widget
// ziyaretçilerinin company üyeliği olmadığı için doğal olarak hariç kalır.
//
// ⚠️ TENANT İZOLASYONU (frontend_plan §21) — 2026-09-12'de burada GERÇEK bir
// sızıntı bulundu: sorgu `companies.workspaceId` ile filtrelenmiyordu. Bir
// kullanıcı A workspace'indeki bir şirketin üyesi olup B workspace'indeki bir
// fikre oy verirse, A'nın şirketi B'nin "kaç müşteri istedi" sayacına
// yazılıyordu. `companies` join'i + workspaceId filtresi bu kapıyı tutar.
export async function loadCustomerCounts(
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) {
    return new Map();
  }
  const rows = await getDb()
    .select({
      postId: votes.postId,
      companyCount: countDistinct(companyMembers.companyId),
    })
    .from(votes)
    .innerJoin(companyMembers, eq(companyMembers.userId, votes.userId))
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(
      and(
        inArray(votes.postId, postIds),
        eq(companies.workspaceId, await getWorkspaceId()),
      ),
    )
    .groupBy(votes.postId);

  return new Map(rows.map((row) => [row.postId, row.companyCount]));
}
