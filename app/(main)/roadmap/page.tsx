import { and, countDistinct, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { CommentCountBadge } from "@/components/custom/comment-count-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { roadmapStatuses } from "@/lib/post-format";
import { comments, posts, votes } from "@/lib/db/schema";

// Herkese açık yol haritası (plan.md Sprint 8): kanban görünümü —
// Planlandı / Geliştiriliyor / Yayında kolonları, kartlar oy + yorum
// sayısıyla (Sprint 13).

// Canlı liste: her istekte DB'den okunur, build zamanında dondurulmaz.
export const dynamic = "force-dynamic";

const columnTitles: Record<string, string> = {
  planned: "Planlandı",
  "in-progress": "Geliştiriliyor",
  shipped: "Yayında",
};

// Kolon noktası StatusBadge renkleriyle aynı dil (Sprint 36).
const columnDotStyles: Record<string, string> = {
  planned: "bg-sky-500",
  "in-progress": "bg-amber-500",
  shipped: "bg-emerald-500",
};

export default async function RoadmapPage() {
  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let loadError = false;

  try {
    rows = await loadPosts();
  } catch (err) {
    console.error(
      "Roadmap load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Yol Haritası</h1>
          <p className="mt-2 text-muted-foreground">
            Hangi özelliklerin planlandığını, geliştirildiğini ve yayınlandığını
            şeffafça takip et.
          </p>
        </div>
        <Link
          href="/portal"
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Portala dön
        </Link>
      </div>

      {loadError ? (
        <p className="mt-8 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Yol haritası yüklenemedi. Sayfayı yenilemeyi dene.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {roadmapStatuses.map((status) => {
            const columnPosts = rows.filter((post) => post.status === status);

            return (
              <section key={status} className="grid content-start gap-3">
                <h2 className="flex items-center justify-between text-lg font-semibold">
                  <span className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${columnDotStyles[status]}`}
                      aria-hidden="true"
                    />
                    {columnTitles[status]}
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {columnPosts.length}
                  </span>
                </h2>

                {columnPosts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Bu kolonda henüz fikir yok.
                    <Link
                      href="/portal"
                      className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Portaldan fikir öner →
                    </Link>
                  </div>
                ) : (
                  columnPosts.map((post) => (
                    <Card key={post.id}>
                      <CardHeader>
                        <CardTitle className="text-base leading-snug">
                          <Link
                            href={`/portal/${post.id}`}
                            className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                          >
                            {post.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <StatusBadge status={post.status} />
                          <span>{post.voteCount} oy</span>
                          <CommentCountBadge
                            postId={post.id}
                            count={post.commentCount}
                          />
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {post.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

async function loadPosts() {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      // İki leftJoin satır çoğaltır (fan-out): count yerine countDistinct
      // şart, yoksa oy/yorum sayıları şişer (plan.md Sprint 13). Yorum
      // sayısına iç notlar dahil değildir (join koşulunda filtre).
      voteCount: countDistinct(votes.id),
      commentCount: countDistinct(comments.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .leftJoin(
      comments,
      and(eq(comments.postId, posts.id), eq(comments.isInternal, false)),
    )
    // Sprint 20: birleşmiş fikirler roadmap'te görünmez.
    .where(
      and(eq(posts.workspaceId, await getWorkspaceId()), isNull(posts.mergedIntoId)),
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(100);
}
