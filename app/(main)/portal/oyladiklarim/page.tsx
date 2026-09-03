import { and, countDistinct, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { ArrowLeftIcon } from "lucide-react";

import { CommentCountBadge } from "@/components/custom/comment-count-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { VoteButton } from "@/components/custom/vote-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { comments, posts, votes } from "@/lib/db/schema";
import { summarize } from "@/lib/post-format";

// Kullanıcının kendi oyları (plan.md Sprint 15): en son oyladığı üstte.
// Statik segment "oyladiklarim" /portal/[id] rotasını gölgeler; çakışma
// yok — [id] zaten uuid doğrulamasıyla geçersiz id'lerde 404 veriyor.
// Oy geri çekme mevcut VoteButton + DELETE /api/votes ile çalışır.
export const dynamic = "force-dynamic";

export default async function MyVotesPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="container mx-auto max-w-3xl p-4 sm:p-8">
        <BackLink />
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Oyladıklarını görmek için giriş yap</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Oy verdiğin fikirler burada listelenir.
          </p>
          <div className="mt-4">
            <SignInButton>
              <button className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Giriş yap
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  let rows: Awaited<ReturnType<typeof loadMyVotes>> = [];
  let loadError = false;

  try {
    rows = await loadMyVotes(userId);
  } catch (err) {
    console.error(
      "My votes load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <BackLink />

      <h1 className="mt-6 text-2xl font-bold">Oyladıklarım</h1>
      <p className="mt-2 text-muted-foreground">
        Oy verdiğin fikirler, en son oyladığın üstte. Oyunu geri almak için oy
        butonuna tekrar bas.
      </p>

      <div className="mt-8 grid gap-4">
        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Henüz kimseye oy vermedin</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Beğendiğin fikirlere oy ver; en çok istenenler yol haritasına
              girer.
            </p>
            <Link
              href="/portal"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Fikirlere göz at
            </Link>
          </div>
        ) : (
          rows.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="leading-snug">
                    <Link
                      href={`/portal/${post.id}`}
                      className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {post.title}
                    </Link>
                  </CardTitle>
                  <VoteButton
                    postId={post.id}
                    initialCount={post.voteCount}
                    initialVoted
                  />
                </div>
                <CardDescription className="flex items-center gap-2">
                  <StatusBadge status={post.status} />
                  <CommentCountBadge
                    postId={post.id}
                    count={post.commentCount}
                  />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {summarize(post.description)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/portal"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      Portala dön
    </Link>
  );
}

async function loadMyVotes(userId: string) {
  // 1) Kullanıcının oyları — unique(user_id, post_id) sayesinde fikir
  // başına en fazla bir satır; sıralama "en son oyladığın üstte".
  const myVotes = await getDb()
    .select({ postId: votes.postId, votedAt: votes.createdAt })
    .from(votes)
    .where(eq(votes.userId, userId))
    .orderBy(desc(votes.createdAt))
    .limit(200);

  if (myVotes.length === 0) {
    return [];
  }

  // 2) Bu fikirlerin toplam oy + yorum sayıları. Çift leftJoin fan-out'a
  // karşı countDistinct şart; yorum sayısına iç notlar dahil değildir
  // (join koşulunda is_internal=false — plan.md Sprint 13 pattern'i).
  const ids = myVotes.map((row) => row.postId);
  const postRows = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      voteCount: countDistinct(votes.id),
      commentCount: countDistinct(comments.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .leftJoin(
      comments,
      and(eq(comments.postId, posts.id), eq(comments.isInternal, false)),
    )
    .where(
      and(eq(posts.workspaceId, await getWorkspaceId()), inArray(posts.id, ids)),
    )
    .groupBy(posts.id);

  const votedAtById = new Map(
    myVotes.map((row) => [row.postId, row.votedAt.getTime()]),
  );

  return postRows.sort(
    (a, b) =>
      (votedAtById.get(b.id) ?? 0) - (votedAtById.get(a.id) ?? 0),
  );
}
