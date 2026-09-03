import { countDistinct, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import { companyMembers, votes } from "./schema";

// Sprint 30: bir fikre oy veren kullanıcıların bağlı olduğu şirket
// sayısı (Canny'nin "kaç müşteri istedi" sayacı). Aynı şirketten birden çok
// kullanıcı oy verse de şirket bir kez sayılır (countDistinct). Widget
// ziyaretçilerinin company üyeliği olmadığı için doğal olarak hariç kalır.
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
    .where(inArray(votes.postId, postIds))
    .groupBy(votes.postId);

  return new Map(rows.map((row) => [row.postId, row.companyCount]));
}
