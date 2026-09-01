import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { Show, SignInButton } from "@clerk/nextjs";
import { RocketIcon, SearchIcon, ThumbsUpIcon } from "lucide-react";

import { NewPostDialog } from "@/components/custom/new-post-dialog";
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
import { statusLabels } from "@/lib/post-format";
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQuery } = await searchParams;
  const searchQuery = (rawQuery ?? "").trim().slice(0, 100);

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let votedIds = new Set<string>();
  let loadError = false;

  try {
    rows = await loadPosts(searchQuery);

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
                      <CardTitle className="leading-snug">{post.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {dateFormatter.format(post.updatedAt)}
                        <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {statusLabels[post.status] ?? post.status}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                        <CardTitle className="leading-snug">{post.title}</CardTitle>
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
                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {statusLabels[post.status] ?? post.status}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
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

async function loadPosts(searchQuery: string) {
  const likePattern = `%${searchQuery
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")}%`;

  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(
      searchQuery
        ? or(ilike(posts.title, likePattern), ilike(posts.description, likePattern))
        : undefined,
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(100);
}
