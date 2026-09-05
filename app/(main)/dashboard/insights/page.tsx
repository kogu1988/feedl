import { redirect } from "next/navigation";
import { asc, count, desc, eq } from "drizzle-orm";

import { CorpusInsights } from "@/components/custom/corpus-insights";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { posts, votes } from "@/lib/db/schema";
import { analyzeCorpus } from "@/lib/ai/insights";

// Canlı veri + LLM çağrısı (yavaş olabilir).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sprint 61 (corpus AI içgörüleri) — OpenAI/Claude "asıl moat": feedback
// korpusunu analiz eder (tek tek değil). En çok oy alan en fazla 60 fikir
// LLM'e verilir; temas/trend/risk/hızlı kazanım önerisi üretilir.
const MAX_CORPUS = 60;

export default async function InsightsPage() {
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  let insights: Awaited<ReturnType<typeof analyzeCorpus>> | null = null;
  let error: string | null = null;
  let corpusSize = 0;
  try {
    const workspaceId = await getWorkspaceId();
    const db = getDb();
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        voteCount: count(votes.id),
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(eq(posts.workspaceId, workspaceId))
      .groupBy(posts.id)
      .orderBy(desc(count(votes.id)), asc(posts.id))
      .limit(MAX_CORPUS);
    corpusSize = rows.length;

    if (rows.length > 0) {
      insights = await analyzeCorpus(
        rows.map((r) => ({
          title: r.title,
          description: r.description,
          status: r.status,
          votes: Number(r.voteCount),
        })),
      );
    }
  } catch (err) {
    console.error("InsightsPage failed:", err instanceof Error ? err.message : err);
    error = "AI içgörü üretilemedi. Lütfen tekrar deneyin.";
  }

  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI İçgörüleri</h1>
          <p className="mt-2 text-muted-foreground">
            Geri bildirim korpusunu analiz eder — temalar, trendler, riskler ve
            hızlı kazanımlar. (En çok oy alan en fazla {MAX_CORPUS} fikir.)
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
        >
          Yenile
        </button>
      </div>

      {corpusSize === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Henüz fikir yok. İlk feedback geldiğinde korpus analizi burada görünecek.
        </p>
      ) : error ? (
        <Card className="mt-8">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {corpusSize} fikir işlenecekti. AI servisi geçici olarak
              yanıt vermiyor olabilir.
            </p>
          </CardContent>
        </Card>
      ) : insights ? (
        <CorpusInsights data={insights} />
      ) : null}
    </main>
  );
}
