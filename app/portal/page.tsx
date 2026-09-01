import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Show, SignInButton } from "@clerk/nextjs";
import { RocketIcon, SearchIcon, ThumbsUpIcon } from "lucide-react";

import { NewPostDialog } from "@/components/custom/new-post-dialog";
import { FilterTabs } from "@/components/custom/filter-tabs";
import { KeywordChips } from "@/components/custom/keyword-chips";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { VoteButton } from "@/components/custom/vote-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/db";
import { buildPostSearch } from "@/lib/post-search";
import { posts, votes } from "@/lib/db/schema";

// Canlı liste: her istekte DB'den okunur, build zamanında dondurulmaz.
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function summarize(text: string, maxLength = 160) {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q: rawQuery, sort: rawSort } = await searchParams;
  const searchQuery = (rawQuery ?? "").trim().slice(0, 100);
  // plan.md Sprint 12: "top" varsayılan (Canny modeli — en çok istenen öne
  // çıkar), "new" en yeni; arama varken alaka sıralaması önceliklidir.
  const sort = rawSort === "new" ? "new" : "top";

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let votedIds = new Set<string>();
  let loadError = false;

  try {
    rows = await loadPosts(searchQuery, sort);

    const { userId } = await auth();
    if (userId && rows.length > 0) {
      const mine = await getDb()
        .select({ postId: votes.postId })
        .from(votes)
        .where(
          and(
            eq(votes.userId, userId),
            inArray(
              votes.postId,
              rows.map((row) => row.id),
            ),
          ),
        );
      votedIds = new Set(mine.map((row) => row.postId));
    }
  } catch (err) {
    console.error(
      "Portal list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  // plan.md Sprint 6: yayınlanan fikirler changelog mantığıyla ayrı listede,
  // en son yayınlanan üstte. Aktif fikirler eskisi gibi en yeni üstte.
  const activePosts = rows.filter((post) => post.status !== "shipped");
  const shippedPosts = rows
    .filter((post) => post.status === "shipped")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fikir Portalı</h1>
          <p className="mt-2 text-muted-foreground">
            Özellik isteklerini paylaş, oy ver, öne çıkanları belirle.
          </p>
          <a
            href="/roadmap"
            className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Yol Haritası →
          </a>
        </div>

        <Show when="signed-in">
          <NewPostDialog />
        </Show>
        <Show when="signed-out">
          <SignInButton>
            <button className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Fikir göndermek için giriş yap
            </button>
          </SignInButton>
        </Show>
      </div>

      <form action="/portal" method="get" className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Fikirler içinde ara..."
            aria-label="Fikirlerde ara"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>

      {!searchQuery ? (
        <div className="mt-4">
          <FilterTabs
            paramName="sort"
            basePath="/portal"
            active={sort === "new" ? "new" : ""}
            options={[
              { value: "", label: "En Çok Oy Alan" },
              { value: "new", label: "En Yeni" },
            ]}
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4">
        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : rows.length === 0 && searchQuery ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Aramanla eşleşen fikir yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Belki de bu özelliği ilk sen istersin — yukarıdan gönder.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Henüz fikir yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              İlk fikri sen gönder; ürün yol haritası buradan başlıyor.
            </p>
          </div>
        ) : (
          <>
            {shippedPosts.length > 0 && (
              <section className="grid gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <RocketIcon className="size-5" aria-hidden="true" />
                  Yayında
                </h2>
                {shippedPosts.map((post) => (
                  <Card key={post.id}>
                    <CardHeader>
                      <CardTitle className="leading-snug">
                        <Link
                          href={`/portal/${post.id}`}
                          className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                        >
                          {post.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {dateFormatter.format(post.updatedAt)}
                        <StatusBadge status={post.status} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        {post.sentimentLabel ||
                        (post.aiKeywords && post.aiKeywords.length > 0) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {post.sentimentLabel ? (
                              <SentimentBadge sentiment={post.sentimentLabel} />
                            ) : null}
                            {post.aiKeywords && post.aiKeywords.length > 0 ? (
                              <KeywordChips keywords={post.aiKeywords} max={4} />
                            ) : null}
                          </div>
                        ) : null}
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {summarize(post.description)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {activePosts.length > 0 && (
              <section className="mt-4 grid gap-4">
                <h2 className="text-lg font-semibold">Fikirler</h2>
                {activePosts.map((post) => (
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
                        <Show when="signed-in">
                          <VoteButton
                            postId={post.id}
                            initialCount={post.voteCount}
                            initialVoted={votedIds.has(post.id)}
                          />
                        </Show>
                        <Show when="signed-out">
                          <SignInButton>
                            <button
                              type="button"
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                              aria-label="Oy vermek için giriş yap"
                            >
                              <ThumbsUpIcon className="size-4" aria-hidden="true" />
                              {post.voteCount}
                            </button>
                          </SignInButton>
                        </Show>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        {dateFormatter.format(post.createdAt)}
                        <StatusBadge status={post.status} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        {post.sentimentLabel ||
                        (post.aiKeywords && post.aiKeywords.length > 0) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {post.sentimentLabel ? (
                              <SentimentBadge sentiment={post.sentimentLabel} />
                            ) : null}
                            {post.aiKeywords && post.aiKeywords.length > 0 ? (
                              <KeywordChips keywords={post.aiKeywords} max={4} />
                            ) : null}
                          </div>
                        ) : null}
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {summarize(post.description)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// plan.md Sprint 8 + 12: arama çok kelimeli ve diakritik duyarsız (lib/
// post-search); sıralama — arama varken alaka (skor → oy → tarih), yoksa
// sekme seçimi: "top" oy sayısına göre, "new" en yeni.
async function loadPosts(searchQuery: string, sort: "top" | "new") {
  const search = buildPostSearch(searchQuery);

  const orderBys: SQL[] = [];
  if (search.tokens.length > 0) {
    orderBys.push(desc(search.score), desc(sql`count(${votes.id})`));
  } else if (sort === "top") {
    orderBys.push(desc(sql`count(${votes.id})`));
  }
  orderBys.push(desc(posts.createdAt));

  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(search.condition)
    .groupBy(posts.id)
    .orderBy(...orderBys)
    .limit(100);
}
