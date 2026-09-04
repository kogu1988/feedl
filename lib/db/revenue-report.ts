import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import {
  companies,
  companyMembers,
  opportunities,
  postOpportunities,
  posts,
  votes,
} from "./schema";

// Sprint 45 (PM raporu §9 madde 9) — gelişmiş revenue/reporting.
// Mevcut şirket/fırsat verisinden segment MRR, yenileme/churn riski ve
// dealbreaker (gelir açısından en kritik fikirler) hesaplanır. Tamamı
// salt-okunur rapor; skor yalnızca burada üretilir.

const toNumber = (value: unknown): number => {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export interface RevenueReport {
  summary: {
    companyCount: number;
    totalMrr: number;
    activeMrr: number;
    atRiskMrr: number;
    churnedMrr: number;
  };
  bySegment: { segment: string | null; companyCount: number; mrr: number }[];
  renewalRisk: {
    companyId: string;
    name: string;
    mrr: number;
    renewalDate: string | null;
    daysUntilRenewal: number | null;
  }[];
  churnCandidates: { companyId: string; name: string; mrr: number }[];
  dealbreakers: {
    postId: string;
    title: string;
    status: string;
    voteCount: number;
    customerCount: number;
    revenueExposure: number;
  }[];
}

export async function loadRevenueReport(): Promise<RevenueReport> {
  const workspaceId = await getWorkspaceId();

  const [companyRows, oppRows, dealRows] = await Promise.all([
    getDb()
      .select({
        id: companies.id,
        name: companies.name,
        mrr: companies.mrr,
        status: companies.status,
        renewalDate: companies.renewalDate,
        segment: companies.segment,
      })
      .from(companies)
      .where(eq(companies.workspaceId, workspaceId)),
    getDb()
      .select({
        companyId: opportunities.companyId,
        stage: opportunities.stage,
        dealValue: opportunities.dealValue,
      })
      .from(opportunities)
      .where(eq(opportunities.workspaceId, workspaceId)),
    // Dealbreaker: oy alan ve şirket/fırsat bağı olan fikirlerin gelir
    // maruziyeti (şirket MRR toplamı + açık fırsat değeri). Oy sayısı ve
    // müşteri sayısı ayrı alt sorgularla toplanır (fan-out yok).
    getDb()
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        voteCount: sql<number>`(SELECT count(*) FROM ${votes} WHERE ${votes.postId} = ${posts.id})::int`,
      })
      .from(posts)
      .where(and(eq(posts.workspaceId, workspaceId), isNull(posts.mergedIntoId)))
      .orderBy(sql`(SELECT count(*) FROM ${votes} WHERE ${votes.postId} = ${posts.id}) DESC`)
      .limit(20),
  ]);

  // MRR özeti + segment kırılımı.
  let totalMrr = 0;
  let activeMrr = 0;
  let atRiskMrr = 0;
  let churnedMrr = 0;
  const segmentMap = new Map<string, { companyCount: number; mrr: number }>();
  const today = new Date();

  const churnCandidateSet = new Set<string>();
  const lostCompanyIds = new Set(
    oppRows.filter((o) => o.stage === "lost").map((o) => o.companyId),
  );
  const openDealByCompany = new Map<string, number>();
  for (const opp of oppRows) {
    if (opp.stage === "open" || opp.stage === "proposal") {
      openDealByCompany.set(
        opp.companyId,
        (openDealByCompany.get(opp.companyId) ?? 0) + toNumber(opp.dealValue),
      );
    }
  }

  const renewalRisk: RevenueReport["renewalRisk"] = [];
  const churnCandidates: RevenueReport["churnCandidates"] = [];

  for (const company of companyRows) {
    const mrr = toNumber(company.mrr);
    totalMrr += mrr;
    if (company.status === "churned") {
      churnedMrr += mrr;
    } else if (company.status === "at_risk") {
      atRiskMrr += mrr;
    } else {
      activeMrr += mrr;
    }

    const segmentKey = company.segment ?? "Diğer";
    const seg = segmentMap.get(segmentKey) ?? { companyCount: 0, mrr: 0 };
    seg.companyCount += 1;
    seg.mrr += mrr;
    segmentMap.set(segmentKey, seg);

    // Yenileme riski: at_risk veya 90 güne yakın yenileme tarihi.
    let daysUntilRenewal: number | null = null;
    if (company.renewalDate) {
      const renewal = new Date(`${company.renewalDate}T00:00:00Z`);
      daysUntilRenewal = Math.ceil(
        (renewal.getTime() - today.getTime()) / 86_400_000,
      );
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 90) {
        renewalRisk.push({
          companyId: company.id,
          name: company.name,
          mrr,
          renewalDate: company.renewalDate,
          daysUntilRenewal,
        });
      }
    }
    if (lostCompanyIds.has(company.id) || company.status === "churned") {
      churnCandidateSet.add(company.id);
      churnCandidates.push({ companyId: company.id, name: company.name, mrr });
    }
  }

  const report: RevenueReport = {
    summary: {
      companyCount: companyRows.length,
      totalMrr,
      activeMrr,
      atRiskMrr,
      churnedMrr,
    },
    bySegment: [...segmentMap.entries()]
      .map(([segment, value]) => ({
        segment: segment === "Diğer" ? null : segment,
        companyCount: value.companyCount,
        mrr: value.mrr,
      }))
      .sort((a, b) => b.mrr - a.mrr),
    renewalRisk: renewalRisk.sort(
      (a, b) => (a.daysUntilRenewal ?? 999) - (b.daysUntilRenewal ?? 999),
    ),
    churnCandidates,
    dealbreakers: [],
  };

  // Dealbreaker'lar için oy veren şirketlerin MRR toplamı + açık fırsat.
  const dealPostIds = dealRows.map((post) => post.id);
  if (dealPostIds.length > 0) {
    const [mrrRows, oppValueRows, custRows] = await Promise.all([
      getDb()
        .select({
          postId: votes.postId,
          companyId: companyMembers.companyId,
          mrr: companies.mrr,
        })
        .from(votes)
        .innerJoin(companyMembers, eq(companyMembers.userId, votes.userId))
        .innerJoin(companies, eq(companies.id, companyMembers.companyId))
        .where(inArray(votes.postId, dealPostIds)),
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
            inArray(postOpportunities.postId, dealPostIds),
            inArray(opportunities.stage, ["open", "proposal"]),
          ),
        ),
      getDb()
        .select({
          postId: votes.postId,
          companyId: companyMembers.companyId,
        })
        .from(votes)
        .innerJoin(companyMembers, eq(companyMembers.userId, votes.userId))
        .where(inArray(votes.postId, dealPostIds)),
    ]);

    const mrrByPost = new Map<string, Set<string>>();
    const mrrTotalByPost = new Map<string, number>();
    for (const row of mrrRows) {
      const set = mrrByPost.get(row.postId) ?? new Set<string>();
      if (set.has(row.companyId)) continue;
      set.add(row.companyId);
      mrrByPost.set(row.postId, set);
      mrrTotalByPost.set(
        row.postId,
        (mrrTotalByPost.get(row.postId) ?? 0) + toNumber(row.mrr),
      );
    }
    const oppValueByPost = new Map<string, number>();
    for (const row of oppValueRows) {
      oppValueByPost.set(
        row.postId,
        (oppValueByPost.get(row.postId) ?? 0) + toNumber(row.dealValue),
      );
    }
    const custCountByPost = new Map<string, Set<string>>();
    for (const row of custRows) {
      const set = custCountByPost.get(row.postId) ?? new Set<string>();
      set.add(row.companyId);
      custCountByPost.set(row.postId, set);
    }

    report.dealbreakers = dealRows
      .map((post) => {
        const revenueExposure =
          (mrrTotalByPost.get(post.id) ?? 0) +
          (oppValueByPost.get(post.id) ?? 0);
        return {
          postId: post.id,
          title: post.title,
          status: post.status,
          voteCount: toNumber(post.voteCount),
          customerCount: custCountByPost.get(post.id)?.size ?? 0,
          revenueExposure,
        };
      })
      .filter((item) => item.revenueExposure > 0)
      .sort((a, b) => b.revenueExposure - a.revenueExposure)
      .slice(0, 10);
  }

  return report;
}
