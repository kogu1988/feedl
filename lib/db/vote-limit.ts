import "server-only";

import { and, eq, countDistinct } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { posts, votes } from "@/lib/db/schema";
import { getPlanLimits } from "@/lib/paddle";

// Sprint 64 — free plan oy limiti: "50 takipçi" = workspace'te en fazla 50
// benzersiz oy veren (anonim dahil). Aynı kişi bir kez sayılır; başka fikre oy
// atsa da sayı artmaz. Bu, free workspace'in 50'den fazla kişiden gelen oy
// ile sınırlandığını garanti eder (Pro sınırsız).

export interface VoteLimitResult {
  ok: boolean;
  limit: number;
  message?: string;
}

// Saf karar (test edilebilir): yeni bir oy veren limiti aşıyorsa reddet;
// zaten oy vermiş (returning) bir kişi tekrar oy atarsa sayı artmaz → izin.
// limit `Number.MAX_SAFE_INTEGER` ise (Pro) sınırsız — her zaman izin.
export function shouldAllowVote(
  currentVoters: number,
  hasExistingVote: boolean,
  limit: number,
): boolean {
  if (limit === Number.MAX_SAFE_INTEGER) return true;
  if (hasExistingVote) return true;
  return currentVoters < limit;
}

// Verilen kullanıcı bu workspace'te ZATEN bir oy kullandıysa (returning voter)
// sayı artmaz → izin ver. Yeni bir oy veren ise distinct sayı limiti aşıyorsa
// reddet. workspaceId verilmezse getWorkspaceId() (host/session) kullanılır.
export async function enforceVoteLimit(
  userId: string,
  workspaceId?: string,
): Promise<VoteLimitResult> {
  const plan = await getPlanLimits();
  const limit = plan.trackedUserLimit;
  if (limit === Number.MAX_SAFE_INTEGER) return { ok: true, limit };

  const wsId = workspaceId ?? (await getWorkspaceId());

  // Bu workspace'in fikirlerindeki toplam benzersiz oy veren sayısı.
  const [row] = await getDb()
    .select({ value: countDistinct(votes.userId) })
    .from(votes)
    .innerJoin(posts, eq(posts.id, votes.postId))
    .where(eq(posts.workspaceId, wsId));

  const current = Number(row?.value ?? 0);

  // Kullanıcı zaten bir fikre oy vermişse yeniden sayılmaz → izin ver.
  const [existing] = await getDb()
    .select({ id: votes.id })
    .from(votes)
    .innerJoin(posts, eq(posts.id, votes.postId))
    .where(and(eq(votes.userId, userId), eq(posts.workspaceId, wsId)))
    .limit(1);

  if (!shouldAllowVote(current, Boolean(existing), limit)) {
    return {
      ok: false,
      limit,
      message: `Free planında en fazla ${limit} kişi oy kullanabilir. Daha fazla katılım için Pro planına geç.`,
    };
  }

  return { ok: true, limit };
}
