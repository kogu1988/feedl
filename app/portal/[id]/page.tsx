import Link from "next/link";
import { notFound } from "next/navigation";
import { Show, SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { ArrowLeftIcon, EyeOffIcon, SparklesIcon } from "lucide-react";

import { CommentForm } from "@/components/custom/comment-form";
import { KeywordChips } from "@/components/custom/keyword-chips";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { VoteButton } from "@/components/custom/vote-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRole } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { comments, posts, users, votes } from "@/lib/db/schema";
import { trDateFormatter, trDateTimeFormatter } from "@/lib/post-format";

// Fikir detay + yorumlar (plan.md Sprint 10). /portal(.*) middleware'da
// public: okuma herkese açık, yazma işlemleri handler'da auth kontrolü yapar.
// İç notlar (is_internal) yalnızca admin oturumunda sorgulanır ve render
// edilir — müşteriye asla sızmaz.
export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    notFound();
  }
  const postId = parsedId.data;

  const { userId } = await auth();
  let isAdmin = false;
  try {
    isAdmin = userId ? (await getRole(userId)) === "admin" : false;
  } catch {
    isAdmin = false;
  }

  const post = await loadPost(postId, userId);
  if (!post) {
    notFound();
  }

  const commentRows = await loadComments(postId, isAdmin);

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Portala dön
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl leading-snug">{post.title}</CardTitle>
            <Show when="signed-in">
              <VoteButton
                postId={post.id}
                initialCount={post.voteCount}
                initialVoted={post.voted}
              />
            </Show>
            <Show when="signed-out">
              <SignInButton>
                <button
                  type="button"
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  aria-label="Oy vermek için giriş yap"
                >
                  {post.voteCount}
                </button>
              </SignInButton>
            </Show>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <span>{trDateFormatter.format(post.createdAt)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {post.description}
          </p>

          {post.sentimentLabel ||
          (post.aiKeywords && post.aiKeywords.length > 0) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {post.sentimentLabel ? (
                <SentimentBadge sentiment={post.sentimentLabel} />
              ) : null}
              {post.aiKeywords && post.aiKeywords.length > 0 ? (
                <KeywordChips keywords={post.aiKeywords} max={6} />
              ) : null}
            </div>
          ) : null}

          {isAdmin && post.aiSummary ? (
            <div className="grid gap-1 rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                AI Özeti (yalnızca admin)
              </p>
              <p className="text-sm text-muted-foreground">{post.aiSummary}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section id="yorumlar" className="mt-8 grid gap-4">
        <h2 className="text-lg font-semibold">
          Yorumlar ({commentRows.length})
        </h2>

        <Show when="signed-in">
          <Card>
            <CardContent className="pt-6">
              <CommentForm postId={post.id} isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </Show>
        <Show when="signed-out">
          <SignInButton>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-dashed p-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Yorum yazmak için giriş yap
            </button>
          </SignInButton>
        </Show>

        {commentRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Henüz yorum yok — ilk yorumu sen yaz.
          </p>
        ) : (
          commentRows.map((comment) => (
            <Card
              key={comment.id}
              className={
                comment.isInternal
                  ? "border-amber-600/30 bg-amber-500/5"
                  : undefined
              }
            >
              <CardHeader>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {comment.authorName ?? "Üye"}
                  </span>
                  <span>{trDateTimeFormatter.format(comment.createdAt)}</span>
                  {comment.isInternal ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <EyeOffIcon className="size-3" aria-hidden="true" />
                      İç not
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {comment.body}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}

async function loadPost(postId: string, userId: string | null) {
  const [row] = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      aiSummary: posts.aiSummary,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(eq(posts.id, postId))
    .groupBy(posts.id)
    .limit(1);

  if (!row) {
    return null;
  }

  let voted = false;
  if (userId) {
    const [mine] = await getDb()
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.postId, postId), eq(votes.userId, userId)))
      .limit(1);
    voted = Boolean(mine);
  }

  return { ...row, voted };
}

async function loadComments(postId: string, isAdmin: boolean) {
  return getDb()
    .select({
      id: comments.id,
      body: comments.body,
      isInternal: comments.isInternal,
      createdAt: comments.createdAt,
      authorName: users.name,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(
      isAdmin
        ? eq(comments.postId, postId)
        : and(eq(comments.postId, postId), eq(comments.isInternal, false)),
    )
    .orderBy(asc(comments.createdAt));
}
