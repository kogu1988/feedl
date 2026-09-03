import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "./index";
import {
  companies,
  companyMembers,
  opportunities,
  postOpportunities,
  votes,
} from "./schema";

// Sprint 31: gelir bağlamı (P3.2) — fikir başına iki bileşen döner:
// 1) oy veren şirketlerin toplam MRR'i (şirket distinct; countDistinct yerine
//    JS gruplaması — MRR'i tek geçişte toplamak için)
// 2) fikre bağlı açık fırsatların (open/proposal) dealValue toplamı
export async function loadRevenueContexts(postIds: string[]): Promise<{
  mrrByPost: Map<string, number>;
  opportunityValueByPost: Map<string, number>;
}> {
  const empty = {
    mrrByPost: new Map<string, number>(),
    opportunityValueByPost: new Map<string, number>(),
  };
  if (postIds.length === 0) {
    return empty;
  }

  const [mrrRows, opportunityRows] = await Promise.all([
    getDb()
      .select({
        postId: votes.postId,
        companyId: companyMembers.companyId,
        mrr: companies.mrr,
      })
      .from(votes)
      .innerJoin(companyMembers, eq(companyMembers.userId, votes.userId))
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(inArray(votes.postId, postIds)),
    getDb()
      .select({
        postId: postOpportunities.postId,
        dealValue: opportunities.dealValue,
      })
      .from(postOpportunities)
      .innerJoin(
        opportunities,
        eq(opportunities.id, postOpportunities.opportunityId),
      )
      .where(
        and(
          inArray(postOpportunities.postId, postIds),
          // won/lost skor dışı: kazanılmış fırsat MRR'de zaten var,
          // kaybedilen ise artık gelir vaadi taşımıyor.
          inArray(opportunities.stage, ["open", "proposal"]),
        ),
      ),
  ]);

  const mrrByPost = new Map<string, number>();
  const seenCompaniesByPost = new Map<string, Set<string>>();
  for (const row of mrrRows) {
    const companiesSeen = seenCompaniesByPost.get(row.postId) ?? new Set();
    if (companiesSeen.has(row.companyId)) {
      continue;
    }
    companiesSeen.add(row.companyId);
    seenCompaniesByPost.set(row.postId, companiesSeen);
    mrrByPost.set(
      row.postId,
      (mrrByPost.get(row.postId) ?? 0) + Number(row.mrr ?? 0),
    );
  }

  const opportunityValueByPost = new Map<string, number>();
  for (const row of opportunityRows) {
    opportunityValueByPost.set(
      row.postId,
      (opportunityValueByPost.get(row.postId) ?? 0) +
        Number(row.dealValue ?? 0),
    );
  }

  return { mrrByPost, opportunityValueByPost };
}

// Sprint 31 gelir skoru: oy + müşteri ağırlığı + gelir bağlamı. Tüm
// yüzeyler (dashboard tablosu, CSV) bu tek fonksiyonu kullanır.
export function computeRevenueScore(input: {
  voteCount: number;
  customerCount: number;
  mrrTotal: number;
  openOpportunityValue: number;
}): number {
  return Math.round(
    input.voteCount +
      10 * input.customerCount +
      (input.mrrTotal + input.openOpportunityValue) / 1000,
  );
}
