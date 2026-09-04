import Link from "next/link";
import { notFound } from "next/navigation";
import { Show, SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { and, asc, count, countDistinct, desc, eq, gt, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ArrowLeftIcon, GitMergeIcon, SparklesIcon } from "lucide-react";

import { CommentCard } from "@/components/custom/comment-card";
import { FollowButton } from "@/components/custom/follow-button";
import { CommentForm } from "@/components/custom/comment-form";
import { CommentCountBadge } from "@/components/custom/comment-count-badge";
import { KeywordChips } from "@/components/custom/keyword-chips";
import { MergeControls } from "@/components/custom/merge-controls";
import {
  OpportunityLinkControls,
  type LinkableOpportunity,
} from "@/components/custom/opportunity-link-controls";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { TagChips } from "@/components/custom/tag-chips";
import { TypeBadge } from "@/components/custom/type-badge";
import { TypeSelect } from "@/components/custom/type-select";
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
import { loadCustomerCounts } from "@/lib/db/customer-counts";
import { getWorkspaceId } from "@/lib/db/workspace";
import {
  comments,
  companies,
  opportunities,
  postFollowers,
  postOpportunities,
  postTags,
  posts,
  tags,
  users,
  votes,
} from "@/lib/db/schema";
import { trDateFormatter } from "@/lib/post-format";

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

  // Sprint 30: kaç şirket istedi (yalnızca admin kutusunda gösterilir).
  let customerCount = 0;
  if (isAdmin) {
    customerCount =
      (await loadCustomerCounts([post.id]))?.get(post.id) ?? 0;
  }

  // Sprint 31: fırsat bağlama verileri (yalnızca admin kutusunda kullanılır).
  let opportunityItems: LinkableOpportunity[] = [];
  let linkedOpportunityIds: string[] = [];
  if (isAdmin) {
    const [opportunityRows, linkRows] = await Promise.all([
      getDb()
        .select({
          id: opportunities.id,
          title: opportunities.title,
          stage: opportunities.stage,
          dealValue: opportunities.dealValue,
          companyName: companies.name,
        })
        .from(opportunities)
        .innerJoin(companies, eq(companies.id, opportunities.companyId))
        .where(eq(opportunities.workspaceId, await getWorkspaceId()))
        .orderBy(desc(opportunities.createdAt)),
      getDb()
        .select({ opportunityId: postOpportunities.opportunityId })
        .from(postOpportunities)
        .where(eq(postOpportunities.postId, postId)),
    ]);
    opportunityItems = opportunityRows;
    linkedOpportunityIds = linkRows.map((row) => row.opportunityId);
  }

  // Sprint 20: birleşmiş fikir hedefinin başlığını banner'da gösterir.
  let mergedInto: { id: string; title: string } | null = null;
  if (post.mergedIntoId) {
    const [target] = await getDb()
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(eq(posts.id, post.mergedIntoId))
      .limit(1);
    if (target) {
      mergedInto = target;
    }
  }

  // Sprint 21: fikrin etiketleri (tags/post_tags).
  const tagRows = await getDb()
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId));
  const postTagsList = tagRows.map((row) => row.name);

  const commentRows = await loadComments(postId, isAdmin);

  // Benzer fikirler best-effort: embedding/vektör sorgusu başarısız olsa
  // bile detay sayfası açılmaya devam eder, bölüm yalnızca gizlenir.
  let similarPosts: Awaited<ReturnType<typeof loadSimilarPosts>> = [];
  try {
    similarPosts = await loadSimilarPosts(postId);
  } catch (err) {
    console.error(
      "Similar posts load failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Portala dön
      </Link>

      {mergedInto ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-600/30 bg-amber-500/10 p-3 text-sm">
          <GitMergeIcon className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <span>
            Bu fikir{" "}
            <Link
              href={`/portal/${mergedInto.id}`}
              className="font-medium underline underline-offset-4"
            >
              {mergedInto.title}
            </Link>{" "}
            ile birleştirildi — oy ve yorumlar hedef fikirde.
          </span>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl leading-snug">{post.title}</CardTitle>
            {mergedInto ? (
              // Birleşmiş fikirde oy butonu kapalı: oylar hedef fikirde.
              <span
                className="inline-flex shrink-0 items-center rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground"
                aria-label="Birleşmiş fikir — oy hedef fikirde"
              >
                {post.voteCount}
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <Show when="signed-in">
                  <VoteButton
                    postId={post.id}
                    initialCount={post.voteCount}
                    initialVoted={post.voted}
                  />
                  <FollowButton
                    postId={post.id}
                    initialFollowing={post.following}
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
            )}
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            {post.postType ? <TypeBadge type={post.postType} /> : null}
            <span>{trDateFormatter.format(post.createdAt)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {post.description}
          </p>

          {post.sentimentLabel ||
          (post.aiKeywords && post.aiKeywords.length > 0) ||
          postTagsList.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {post.sentimentLabel ? (
                <SentimentBadge sentiment={post.sentimentLabel} />
              ) : null}
              {postTagsList.length > 0 ? (
                <TagChips tags={postTagsList} />
              ) : post.aiKeywords && post.aiKeywords.length > 0 ? (
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

          {isAdmin ? (
            <div className="grid gap-2 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Müşteri (yalnızca admin)
              </p>
              <p className="text-sm tabular-nums">
                {customerCount} müşteri bu fikre oy verdi
              </p>
            </div>
          ) : null}

          {isAdmin ? (
            <div className="grid gap-2 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Fikir türü (yalnızca admin)
              </p>
              <div>
                <TypeSelect postId={post.id} type={post.postType} />
              </div>
            </div>
          ) : null}

          {isAdmin ? (
            <MergeControls postId={post.id} mergedInto={mergedInto} />
          ) : null}

          {isAdmin ? (
            <OpportunityLinkControls
              postId={post.id}
              opportunities={opportunityItems}
              linkedIds={linkedOpportunityIds}
            />
          ) : null}
        </CardContent>
      </Card>

      <section id="yorumlar" className="mt-8 grid gap-4">
        <h2 className="text-lg font-semibold">
          Yorumlar ({commentRows.length})
        </h2>

        <Show when="signed-in">
          {mergedInto ? null : (
            <Card>
              <CardContent className="pt-6">
                <CommentForm postId={post.id} isAdmin={isAdmin} />
              </CardContent>
            </Card>
          )}
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
          commentRows
            .filter((comment) => !comment.parentId)
            .map((comment) => {
              const replies = commentRows.filter(
                (row) => row.parentId === comment.id,
              );
              return (
                <div key={comment.id} className="grid gap-3">
                  <CommentCard
                    postId={post.id}
                    isAdmin={isAdmin}
                    isSignedIn={Boolean(userId)}
                    currentUserId={userId}
                    comment={{
                      id: comment.id,
                      body: comment.body,
                      isInternal: comment.isInternal,
                      createdAt: comment.createdAt,
                      editedAt: comment.editedAt,
                      authorName: comment.authorName,
                      authorUserId: comment.authorUserId,
                    }}
                  />
                  {replies.length > 0 ? (
                    <div className="ml-4 grid gap-3 border-l-2 pl-4 sm:ml-8 sm:pl-6">
                      {replies.map((reply) => (
                        <CommentCard
                          key={reply.id}
                          postId={post.id}
                          isAdmin={isAdmin}
                          isSignedIn={Boolean(userId)}
                          currentUserId={userId}
                          comment={{
                            id: reply.id,
                            body: reply.body,
                            isInternal: reply.isInternal,
                            createdAt: reply.createdAt,
                            editedAt: reply.editedAt,
                            authorName: reply.authorName,
                            authorUserId: reply.authorUserId,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
        )}
      </section>

      {similarPosts.length > 0 ? (
        <section className="mt-8 grid gap-3">
          <h2 className="text-lg font-semibold">Benzer fikirler</h2>
          {similarPosts.map((post) => (
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
            </Card>
          ))}
        </section>
      ) : null}
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
      postType: posts.postType,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      aiSummary: posts.aiSummary,
      mergedIntoId: posts.mergedIntoId,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(and(eq(posts.workspaceId, await getWorkspaceId()), eq(posts.id, postId)))
    .groupBy(posts.id)
    .limit(1);

  if (!row) {
    return null;
  }

  let voted = false;
  let following = false;
  if (userId) {
    const [mine, follow] = await Promise.all([
      getDb()
        .select({ id: votes.id })
        .from(votes)
        .where(and(eq(votes.postId, postId), eq(votes.userId, userId)))
        .limit(1),
      getDb()
        .select({ id: postFollowers.id })
        .from(postFollowers)
        .where(
          and(
            eq(postFollowers.postId, postId),
            eq(postFollowers.userId, userId),
          ),
        )
        .limit(1),
    ]);
    voted = Boolean(mine);
    following = Boolean(follow);
  }

  return { ...row, voted, following };
}

async function loadComments(postId: string, isAdmin: boolean) {
  return getDb()
    .select({
      id: comments.id,
      body: comments.body,
      isInternal: comments.isInternal,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      parentId: comments.parentId,
      authorName: users.name,
      authorUserId: comments.userId,
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

// plan.md Sprint 17: embedding tabanlı "Benzer fikirler" (Canny related
// posts modeli). Vektör JS'e taşınmaz: cosine benzerlik Postgres içinde
// skalar alt sorguyla hesaplanır. Eşik kalibrasyonu inngest/functions.ts
// duplicate eşiğiyle aynı veriye dayanır — alakasız-generic çiftler 0.489'a
// kadar çıkarken yakın-kopyalar 0.547+; 0.5 "gerçekten alakalı" bandı.
const SIMILAR_POSTS_LIMIT = 3;
const SIMILAR_POSTS_MIN_SIMILARITY = 0.5;

async function loadSimilarPosts(postId: string) {
  const currentPost = alias(posts, "current_post");
  const similarity = () =>
    sql<number>`1 - (${posts.embeddingVector} <=> (select ${currentPost.embeddingVector} from ${currentPost} where ${currentPost.id} = ${postId}))`;

  // 1) Embedding'i olan en benzer fikirlerin id'leri (join'siz — sıralama
  //    gruplamasız expression olarak kalır).
  const similarIds = await getDb()
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, await getWorkspaceId()),
        ne(posts.id, postId),
        isNotNull(posts.embeddingVector),
        // Sprint 20: birleşmiş fikirler benzer önerilerde de görünmez.
        isNull(posts.mergedIntoId),
        gt(similarity(), SIMILAR_POSTS_MIN_SIMILARITY),
      ),
    )
    .orderBy(desc(similarity()))
    .limit(SIMILAR_POSTS_LIMIT);

  if (similarIds.length === 0) {
    return [];
  }

  // 2) Kart verisi: oy + yorum (iç notlar hariç) sayıları — çift leftJoin
  //    fan-out'una karşı countDistinct (plan.md Sprint 13 pattern'i).
  const rows = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
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
    .where(inArray(posts.id, similarIds.map((row) => row.id)))
    .groupBy(posts.id);

  const order = new Map(similarIds.map((row, index) => [row.id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
