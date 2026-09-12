import { and, count, eq, inArray, sql } from "drizzle-orm";

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

// Sprint 31 / 2026-09-12 (frontend_plan P0) — İŞ ETKİSİ (business impact)
// katmanının TEK veri kaynağı. Mevcut model GENİŞLETİLİR, yenisi kurulmaz
// (frontend_plan §1/§9): "müşteri" = `companies` (+ `company_members` ile
// kullanıcıya bağlı), gelir = `companies.mrr`, fırsat = `opportunities`.
//
// Bir fikir (post) için etki ŞU İKİ YOLDAN gelir:
//  1) Oyu olan kullanıcıların üyesi olduğu ŞİRKETLER  → müşteri sayısı + MRR
//     ("kim istiyor ve o müşteri ne kadar değerli")
//  2) Fikre bağlı AÇIK fırsatlar (open/proposal)      → potansiyel fırsat değeri
//     (won/lost sayılmaz: kazanılan MRR'de zaten var, kaybedilen vaat taşımaz)
//
// ⚠️ TENANT İZOLASYONU (frontend_plan §21) — 2026-09-12'de burada GERÇEK bir
// sızıntı bulundu: şirket sorguları `companies.workspace_id` ile filtrelenmiyordu.
// Bir kullanıcı A workspace'indeki bir şirketin üyesi olup B workspace'indeki
// bir fikre oy verirse, A'nın şirketi ve MRR'i B'nin skoruna sızıyordu.
// Aşağıdaki iki sorguda da `workspaceId` ZORUNLU filtredir; postIds çağıran
// tarafından zaten workspace'e ait postlardan gelir, ama kapıyı sorgunun
// kendisi de tutar (defense-in-depth).

export interface PostImpactContext {
  // Fikre oy veren kullanıcıların bağlı olduğu DISTINCT şirket sayısı.
  customerCount: number;
  // Toplam oy sayısı (TALEP tarafı — §13: talep ile iş etkisi ayrı gösterilir;
  // şirket üyeliği olmayan oylar da burada sayılır).
  voteCount: number;
  // O şirketlerin MRR toplamı (distinct şirket; çok üyeli şirket bir kez).
  mrrTotal: number;
  // En az bir etkilenen şirketin MRR'i GİRİLMİŞ mi? `null` = girilmemiş,
  // `0` = "0 olarak girilmiş". frontend_plan §19: "$0 MRR" ile "veri yok"
  // aynı şey değildir — bu bayrak ayrımı UI'da korur.
  mrrKnown: boolean;
  // Fikre bağlı açık/proposal fırsatların toplam dealValue'su.
  opportunityValue: number;
  // En az bir açık fırsat bağlı mı? (değeri 0 olsa bile "bağ var" bilgisi.)
  opportunityLinked: boolean;
}

const EMPTY_CONTEXT: PostImpactContext = {
  customerCount: 0,
  voteCount: 0,
  mrrTotal: 0,
  mrrKnown: false,
  opportunityValue: 0,
  opportunityLinked: false,
};

// Birden çok fikir için etki bağlamı — TEK sorgu turu (N+1 yok, §33).
export async function loadPostImpactContexts(
  postIds: string[],
): Promise<Map<string, PostImpactContext>> {
  const result = new Map<string, PostImpactContext>();
  if (postIds.length === 0) {
    return result;
  }

  const workspaceId = await getWorkspaceId();

  const [companyRows, opportunityRows, voteRows] = await Promise.all([
    getDb()
      .select({
        postId: votes.postId,
        companyId: companyMembers.companyId,
        mrr: companies.mrr,
      })
      .from(votes)
      .innerJoin(companyMembers, eq(companyMembers.userId, votes.userId))
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(
        and(
          inArray(votes.postId, postIds),
          eq(companies.workspaceId, workspaceId),
        ),
      ),
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
          eq(opportunities.workspaceId, workspaceId),
          inArray(postOpportunities.postId, postIds),
          inArray(opportunities.stage, ["open", "proposal"]),
        ),
      ),
    // Talep tarafı: oy sayısı (şirket üyeliği olmayan oylar dahil).
    getDb()
      .select({
        postId: votes.postId,
        voteCount: count(),
      })
      .from(votes)
      .innerJoin(posts, eq(posts.id, votes.postId))
      .where(
        and(
          inArray(votes.postId, postIds),
          eq(posts.workspaceId, workspaceId),
        ),
      )
      .groupBy(votes.postId),
  ]);

  // Şirket distinct: aynı şirketin birden çok üyesi oy verse de MRR BİR kez
  // sayılır (aksi halde kalabalık bir müşteri, MRR'ini yapay şişirirdi).
  const seenCompanies = new Map<string, Set<string>>();
  for (const row of companyRows) {
    const perPost = result.get(row.postId) ?? { ...EMPTY_CONTEXT };
    const companiesSeen = seenCompanies.get(row.postId) ?? new Set<string>();
    if (!companiesSeen.has(row.companyId)) {
      companiesSeen.add(row.companyId);
      seenCompanies.set(row.postId, companiesSeen);
      perPost.customerCount += 1;
      perPost.mrrTotal += Number(row.mrr ?? 0);
      // `null` = girilmemiş; `"0"` = 0 olarak girilmiş → "biliniyor".
      if (row.mrr !== null) perPost.mrrKnown = true;
    }
    result.set(row.postId, perPost);
  }

  for (const row of opportunityRows) {
    const perPost = result.get(row.postId) ?? { ...EMPTY_CONTEXT };
    perPost.opportunityValue += Number(row.dealValue ?? 0);
    perPost.opportunityLinked = true;
    result.set(row.postId, perPost);
  }

  for (const row of voteRows) {
    const perPost = result.get(row.postId) ?? { ...EMPTY_CONTEXT };
    perPost.voteCount = Number(row.voteCount ?? 0);
    result.set(row.postId, perPost);
  }

  return result;
}

// Tek fikir için kısayol (post detay sayfası).
export async function loadPostImpactContext(
  postId: string,
): Promise<PostImpactContext> {
  const map = await loadPostImpactContexts([postId]);
  return map.get(postId) ?? { ...EMPTY_CONTEXT };
}

// Geriye dönük uyum (dashboard tablosu + CSV export): ESKİ şekil. Yeni tek
// kaynağın (`loadPostImpactContexts`) üzerine ince adaptördür — iki ayrı
// sorgu yolu tutulmaz.
export async function loadRevenueContexts(postIds: string[]): Promise<{
  mrrByPost: Map<string, number>;
  opportunityValueByPost: Map<string, number>;
}> {
  const contexts = await loadPostImpactContexts(postIds);
  const mrrByPost = new Map<string, number>();
  const opportunityValueByPost = new Map<string, number>();
  for (const [postId, ctx] of contexts) {
    mrrByPost.set(postId, ctx.mrrTotal);
    opportunityValueByPost.set(postId, ctx.opportunityValue);
  }
  return { mrrByPost, opportunityValueByPost };
}

// ── Skor & açıklanabilirlik (frontend_plan §6) ────────────────────────────
// Mevcut skor algoritması KORUNUR (stabil + test edilmiş; §6 "doğrudan
// silme"). Değişen şey: skorun YANINDA nedenini gösteren breakdown.

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

export type PrioritySignal = "high" | "medium" | "low" | "none";

// Öncelik sinyali — KARAR DEĞİL, sinyal (frontend_plan §26: "AI karar verici
// değil, decision support"). Eşikler açık ve açıklanabilir olsun diye skorun
// kendi bileşenlerine göre değil, doğrudan skora göre tanımlıdır.
const SIGNAL_HIGH = 50;
const SIGNAL_MEDIUM = 15;

export function computePrioritySignal(input: {
  voteCount: number;
  customerCount: number;
  mrrTotal: number;
  openOpportunityValue: number;
}): PrioritySignal {
  const hasAnySignal =
    input.voteCount > 0 ||
    input.customerCount > 0 ||
    input.mrrTotal > 0 ||
    input.openOpportunityValue > 0;
  if (!hasAnySignal) return "none";
  const score = computeRevenueScore(input);
  if (score >= SIGNAL_HIGH) return "high";
  if (score >= SIGNAL_MEDIUM) return "medium";
  return "low";
}

// 2026-09-12 (frontend_plan P1-8) — gelir bazlı SIRALAMA.
//
// Skoru SQL'de sıralamak için formülün SQL karşılığı gerekir. Bu ifade
// `computeRevenueScore` ile AYNI olmak ZORUNDA:
//   COUNT(oy) + 10×DISTINCT şirket + (Σ MRR + Σ açık fırsat) / 1000
//
// DİKKAT — neden iki yerde: TS fonksiyonu tabloda/kartta gösterilen DEĞERİ
// üretir, SQL ifadesi sayfalamayı bozmadan SIRALAMAYI yapar (tüm liste JS'e
// çekilmez). İkisi ayrışırsa sıralama ile gösterilen skor tutarsız olur;
// bu yüzden testler ikisini birlikte doğrular
// (tests/lib/post-impact.test.ts → "SQL sıralaması formülle tutarlı").
//
// Tenant izolasyonu: iç sorguların hepsi `c.workspace_id` / `o.workspace_id`
// filtresi taşır — başka workspace'in şirketi sıralamaya giremez (§21).
export function revenueScoreOrderSql(workspaceId: string) {
  return sql`(
    (SELECT COUNT(*) FROM ${votes} v1 WHERE v1.post_id = ${posts.id})
    + 10 * (
      SELECT COUNT(DISTINCT cm.company_id)
      FROM ${companyMembers} cm
      JOIN ${companies} c ON c.id = cm.company_id
      JOIN ${votes} v2 ON v2.user_id = cm.user_id
      WHERE v2.post_id = ${posts.id} AND c.workspace_id = ${workspaceId}
    )
    + (
      COALESCE((
        SELECT SUM(mr.mrr) FROM (
          SELECT DISTINCT c2.id AS id, c2.mrr AS mrr
          FROM ${votes} v3
          JOIN ${companyMembers} cm2 ON cm2.user_id = v3.user_id
          JOIN ${companies} c2 ON c2.id = cm2.company_id
          WHERE v3.post_id = ${posts.id} AND c2.workspace_id = ${workspaceId}
        ) mr
      ), 0)
      + COALESCE((
        SELECT SUM(o.deal_value)
        FROM ${postOpportunities} po
        JOIN ${opportunities} o ON o.id = po.opportunity_id
        WHERE po.post_id = ${posts.id} AND o.workspace_id = ${workspaceId}
          AND o.stage IN ('open', 'proposal')
      ), 0)
    ) / 1000.0
  ) DESC`;
}

export interface ScoreBreakdownRow {
  label: string;
  // Skora katkı (skorun kendi biriminde — yuvarlanmış).
  contribution: number;
  // Kullanıcıya gösterilecek ham değer (ör. "12 müşteri", "$4.850").
  detail: string;
}

// Skoru bileşenlerine ayır — kullanıcı "bu neden 87?" sorusunun cevabını
// görsün (§6). Toplam, `computeRevenueScore` ile birebir tutarlıdır.
export function explainRevenueScore(input: {
  voteCount: number;
  customerCount: number;
  mrrTotal: number;
  openOpportunityValue: number;
}): ScoreBreakdownRow[] {
  const mrrContribution = input.mrrTotal / 1000;
  const opportunityContribution = input.openOpportunityValue / 1000;
  return [
    {
      label: "Oy",
      contribution: input.voteCount,
      detail: `${input.voteCount} oy`,
    },
    {
      label: "Müşteri",
      contribution: 10 * input.customerCount,
      detail: `${input.customerCount} müşteri × 10`,
    },
    {
      label: "Müşteri MRR'i",
      contribution: mrrContribution,
      detail: `$${input.mrrTotal.toLocaleString("tr-TR")} ÷ 1000`,
    },
    {
      label: "Açık fırsat",
      contribution: opportunityContribution,
      detail: `$${input.openOpportunityValue.toLocaleString("tr-TR")} ÷ 1000`,
    },
  ];
}
