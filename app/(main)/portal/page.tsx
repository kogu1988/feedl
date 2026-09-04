import { and, asc, count, countDistinct, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Show, SignInButton } from "@clerk/nextjs";
import { RocketIcon, SearchIcon, ThumbsUpIcon } from "lucide-react";

import { CommentCountBadge } from "@/components/custom/comment-count-badge";
import { NewPostDialog } from "@/components/custom/new-post-dialog";
import { FilterTabs } from "@/components/custom/filter-tabs";
import { PaginationFooter } from "@/components/custom/pagination-footer";
import { KeywordChips } from "@/components/custom/keyword-chips";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { embedText } from "@/lib/ai/openrouter";
import { StatusBadge } from "@/components/custom/status-badge";
import { TagChips } from "@/components/custom/tag-chips";
import { TypeBadge } from "@/components/custom/type-badge";
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
import { getWorkspaceId } from "@/lib/db/workspace";
import { getRole } from "@/lib/auth/admin";
import { listBoards, resolveBoardBySlug } from "@/lib/db/board";
import { summarize, trDateFormatter } from "@/lib/post-format";
import { buildPostSearch, type PostSearch } from "@/lib/post-search";
import { parsePagination } from "@/lib/pagination";
import { comments, postTags, posts, tags, votes } from "@/lib/db/schema";

// Canlı liste: her istekte DB'den okunur, build zamanında dondurulmaz.
export const dynamic = "force-dynamic";

// Sprint 48c: portal linki üretici — aktif board slug'ını ve diğer
// filtreleri (q/sort/tag) korur.
function buildPortalHref(
  boardSlug: string,
  extra?: { q?: string; sort?: string; tag?: string },
): string {
  const params = new URLSearchParams();
  params.set("board", boardSlug);
  if (extra?.q) params.set("q", extra.q);
  if (extra?.sort) params.set("sort", extra.sort);
  if (extra?.tag) params.set("tag", extra.tag);
  return `/portal?${params.toString()}`;
}

// plan.md Sprint 15: yerel dateFormatter + summarize kopyaları lib/
// post-format'a taşındı (tek kaynak kuralı — Sprint 9 statusLabels dersi).

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    tag?: string;
    per?: string;
    page?: string;
    board?: string;
  }>;
}) {
  const {
    q: rawQuery,
    sort: rawSort,
    tag: rawTag,
    per: rawPer,
    page: rawPage,
    board: rawBoard,
  } = await searchParams;
  const searchQuery = (rawQuery ?? "").trim().slice(0, 100);
  // plan.md Sprint 12: "top" varsayılan (Canny modeli — en çok istenen öne
  // çıkar), "new" en yeni; arama varken alaka sıralaması önceliklidir.
  const sort = rawSort === "new" ? "new" : "top";
  // Sprint 21: ?tag= serbest form etiket filtresi (normalize lowercase).
  const tagFilter = (rawTag ?? "").trim().toLocaleLowerCase("tr").slice(0, 30);
  // Sprint 39: sayfa boyutu — 5 varsayılan, 25/50/Tümü (ortak parse;
  // lib/pagination.ts whitelist + makul "Tümü" üst sınırı).
  const { per, perSize, requestedPage } = parsePagination(rawPer, rawPage);
  // Sprint 48c: ?board=slug filtresi — verilmezse varsayılan board (genel).
  const boardSlug = (rawBoard ?? "").trim().toLowerCase().slice(0, 80);

  const { userId } = await auth();
  let isAdmin = false;
  try {
    const { getRole } = await import("@/lib/auth/admin");
    isAdmin = userId ? (await getRole(userId)) === "admin" : false;
  } catch {
    isAdmin = false;
  }

  // Board çözümü: tüm workspace board'ları (seçici için) + aktif board
  // (private ise yalnızca admin; verilmemişse varsayılan genel).
  const [allBoards, activeBoard] = await Promise.all([
    listBoards(),
    resolveBoardBySlug(boardSlug || "genel", isAdmin),
  ]);
  // Geçersiz/private board slug'ı: varsayılana düş (zarif geri dön).
  if (!activeBoard) {
    redirect(`/portal?board=genel`);
  }
  if (activeBoard.visibility === "private" && !isAdmin) {
    redirect(`/portal?board=genel`);
  }
  const activeBoardId = activeBoard.id;

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let totalCount = 0;
  let currentPage = 1;
  let totalPages = 1;
  let votedIds = new Set<string>();
  let tagsByPost = new Map<string, string[]>();
  let tagOptions: Awaited<ReturnType<typeof loadTagOptions>> = [];
  let loadError = false;

  try {
    // Sprint 39: önce toplam sayı — sayfa numarası üst sınıra kelepçelenir,
    // sonra offset/limit ile tek sayfa çekilir. Arama koşulu count ile
    // birebir aynı olduğundan count=0 ⇔ liste boş; vektör fallback
    // kararını count üzerinden veririz (davranış Sprint 27 ile aynı).
    let embedding: number[] | undefined;
    totalCount = await countPosts(searchQuery, tagFilter, undefined, activeBoardId);
    if (totalCount === 0 && searchQuery) {
      try {
        const vector = await embedText(searchQuery);
        if (vector.length === 2048) {
          embedding = vector;
          totalCount = await countPosts(searchQuery, tagFilter, embedding, activeBoardId);
        }
      } catch (embedErr) {
        console.error(
          "Search query embedding failed (FTS fallback):",
          embedErr instanceof Error ? embedErr.message : embedErr,
        );
      }
    }
    totalPages =
      per === "all" ? 1 : Math.max(1, Math.ceil(totalCount / perSize));
    currentPage = Math.min(requestedPage, totalPages);
    rows = await loadPosts(
      searchQuery,
      sort,
      tagFilter,
      embedding,
      perSize,
      (currentPage - 1) * perSize,
      activeBoardId,
    );

    tagOptions = await loadTagOptions();

    if (rows.length > 0) {
      const tagRows = await getDb()
        .select({ postId: postTags.postId, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(
          inArray(
            postTags.postId,
            rows.map((row) => row.id),
          ),
        );
      tagsByPost = tagRows.reduce((map, row) => {
        const list = map.get(row.postId) ?? [];
        list.push(row.name);
        map.set(row.postId, list);
        return map;
      }, new Map<string, string[]>());
    }

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

  // Sprint 48c: erişilebilir board'lar (public herkese + private yalnızca
  // admin). Yalnızca board varsa seçici gösterilir.
  const visibleBoards = isAdmin
    ? allBoards
    : allBoards.filter((board) => board.visibility === "public");

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fikir Portalı</h1>
          <p className="mt-2 text-muted-foreground">
            Özellik isteklerini paylaş, oy ver, öne çıkanları belirle.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="/roadmap"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Yol Haritası
            </a>
            <Show when="signed-in">
              <Link
                href="/portal/oyladiklarim"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Oyladıklarım
              </Link>
            </Show>
          </div>
        </div>

        <Show when="signed-in">
          <NewPostDialog
            boardOptions={visibleBoards
              .filter((board) => board.visibility === "public")
              .map((board) => ({ id: board.id, name: board.name, slug: board.slug }))}
          />
        </Show>
        <Show when="signed-out">
          <SignInButton>
            <Button>Fikir göndermek için giriş yap</Button>
          </SignInButton>
        </Show>
      </div>

      {/* Sprint 48c: board seçici — erişilebilir board'lar (public + admin
          için private). Aktif board vurgulu; diğer filtreler korunur. */}
      {visibleBoards.length > 1 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {visibleBoards.map((board) => {
            const href = buildPortalHref(board.slug, {
              q: searchQuery || undefined,
              sort: rawSort === "new" ? "new" : undefined,
              tag: tagFilter || undefined,
            });
            const active = board.id === activeBoardId;
            return (
              <Link
                key={board.id}
                href={href}
                className={
                  active
                    ? "block rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                    : "block rounded-full border bg-background px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {board.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      <form action="/portal" method="get" className="mt-6 flex gap-2">
        {boardSlug ? (
          <input type="hidden" name="board" value={boardSlug} />
        ) : null}
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
        <>
          <div className="mt-4">
            <FilterTabs
              paramName="sort"
              basePath="/portal"
              active={sort === "new" ? "new" : ""}
              extraParams={{
                ...(tagFilter ? { tag: tagFilter } : {}),
                ...(boardSlug ? { board: boardSlug } : {}),
              }}
              options={[
                { value: "", label: "En Çok Oy Alan" },
                { value: "new", label: "En Yeni" },
              ]}
            />
          </div>
          {tagOptions.length > 0 ? (
            <div className="mt-2">
              <FilterTabs
                paramName="tag"
                basePath="/portal"
                active={tagFilter}
                extraParams={{
                  ...(sort === "new" ? { sort } : {}),
                  ...(boardSlug ? { board: boardSlug } : {}),
                }}
                options={[
                  { value: "", label: "Tüm Etiketler" },
                  ...tagOptions.map((option) => ({
                    value: option.name,
                    label: `#${option.name} (${option.count})`,
                  })),
                ]}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-8 grid gap-4">
        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : rows.length === 0 && (searchQuery || tagFilter) ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Aramanla eşleşen fikir yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Belki de bu özelliği ilk sen istersin — gönder ya da aramayı
              temizle.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Show when="signed-in">
                <NewPostDialog />
              </Show>
              <Show when="signed-out">
                <SignInButton>
                  <Button>Bu fikri ilk sen gönder</Button>
                </SignInButton>
              </Show>
              <Button variant="outline" render={<Link href="/portal" />}>
                Aramayı temizle
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Henüz fikir yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              İlk fikri sen gönder; ürün yol haritası buradan başlıyor.
            </p>
            <div className="mt-4 flex justify-center">
              <Show when="signed-in">
                <NewPostDialog />
              </Show>
              <Show when="signed-out">
                <SignInButton>
                  <Button>İlk fikri sen gönder</Button>
                </SignInButton>
              </Show>
            </div>
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
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {trDateFormatter.format(post.updatedAt)}
                        <StatusBadge status={post.status} />
                        {post.postType ? (
                          <TypeBadge type={post.postType} />
                        ) : null}
                        <CommentCountBadge
                          postId={post.id}
                          count={post.commentCount}
                        />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {post.sentimentLabel ||
                      (post.aiKeywords && post.aiKeywords.length > 0) ||
                      (tagsByPost.get(post.id) ?? []).length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {post.sentimentLabel ? (
                            <SentimentBadge sentiment={post.sentimentLabel} />
                          ) : null}
                          {(tagsByPost.get(post.id) ?? []).length > 0 ? (
                            <TagChips tags={tagsByPost.get(post.id) ?? []} />
                          ) : post.aiKeywords &&
                            post.aiKeywords.length > 0 ? (
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
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {trDateFormatter.format(post.createdAt)}
                        <StatusBadge status={post.status} />
                        {post.postType ? (
                          <TypeBadge type={post.postType} />
                        ) : null}
                        <CommentCountBadge
                          postId={post.id}
                          count={post.commentCount}
                        />
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {post.sentimentLabel ||
                      (post.aiKeywords && post.aiKeywords.length > 0) ||
                      (tagsByPost.get(post.id) ?? []).length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {post.sentimentLabel ? (
                            <SentimentBadge sentiment={post.sentimentLabel} />
                          ) : null}
                          {(tagsByPost.get(post.id) ?? []).length > 0 ? (
                            <TagChips tags={tagsByPost.get(post.id) ?? []} />
                          ) : post.aiKeywords &&
                            post.aiKeywords.length > 0 ? (
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

      {rows.length > 0 ? (
        <PaginationFooter
          basePath="/portal"
          page={currentPage}
          totalPages={totalPages}
          per={per}
          extraParams={{
            ...(sort === "new" ? { sort } : {}),
            ...(tagFilter ? { tag: tagFilter } : {}),
            ...(boardSlug ? { board: boardSlug } : {}),
          }}
          pageParams={{
            ...(searchQuery ? { q: searchQuery } : {}),
            ...(sort === "new" ? { sort } : {}),
            ...(tagFilter ? { tag: tagFilter } : {}),
            ...(boardSlug ? { board: boardSlug } : {}),
            ...(per !== "5" ? { per } : {}),
          }}
        />
      ) : null}
    </main>
  );
}

// plan.md Sprint 8 + 12 + 13: arama çok kelimeli ve diakritik duyarsız
// (lib/post-search); sıralama — arama varken alaka (skor → oy → tarih),
// yoksa sekme seçimi: "top" oy sayısına göre, "new" en yeni. Kartlar oy
// + yorum (iç notlar hariç) sayısını countDistinct ile gösterir.
async function loadPosts(
  searchQuery: string,
  sort: "top" | "new",
  tagFilter: string,
  queryEmbedding: number[] | undefined,
  limit: number,
  offset: number,
  boardId?: string,
) {
  const search = buildPostSearch(searchQuery, queryEmbedding);
  const workspaceId = await getWorkspaceId();

  const orderBys: SQL[] = [];
  if (search.tokens.length > 0) {
    orderBys.push(desc(search.score), desc(countDistinct(votes.id)));
  } else if (sort === "top") {
    orderBys.push(desc(countDistinct(votes.id)));
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
      postType: posts.postType,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
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
    // Sprint 20: birleşmiş fikirler listede görünmez (kaynak arşivlenir).
    // Sprint 39: where koşulu countPosts ile paylaşılır (buildPostConditions).
    .where(buildPostConditions(workspaceId, search, tagFilter, boardId))
    .groupBy(posts.id)
    .orderBy(...orderBys)
    .limit(limit)
    .offset(offset);
}

// Sprint 39: loadPosts ile BİREBİR aynı where koşulu — koşul yalnızca
// posts sütunlarına (title/description/searchVector/embeddingVector/id)
// ve alt sorgulara referans verdiğinden joinsiz sayılabilir; vote/comment
// fan-out'u count'u etkilemez. Tek kaynak kuralı: koşulu burada değiştirir
// sen count'u da bozmuş olursun — buildPostConditions paylaşımlı.
function buildPostConditions(
  workspaceId: string,
  search: PostSearch,
  tagFilter: string,
  boardId?: string,
) {
  // Sprint 21: etiket filtresi — posts.id, etiket adıyla eşleşen
  // post_tags bağlantılarıyla sınırlandırılır (normalize lowercase).
  const tagCondition = tagFilter
    ? inArray(
        posts.id,
        getDb()
          .select({ postId: postTags.postId })
          .from(postTags)
          .innerJoin(tags, eq(tags.id, postTags.tagId))
          .where(
            and(eq(tags.name, tagFilter), eq(tags.workspaceId, workspaceId)),
          ),
      )
    : undefined;

  // Sprint 48c: board kapsamı — ?board=slug verildiyse o board'a, yoksa
  // varsayılan board'a (genel) ait fikirler. boardId undefined ise koşul
  // eklenmez (gerçek, board'sız sorgular için esnek kalır).
  const boardCondition = boardId ? eq(posts.boardId, boardId) : undefined;

  return and(
    eq(posts.workspaceId, workspaceId),
    boardCondition,
    search.condition,
    isNull(posts.mergedIntoId),
    tagCondition,
  );
}

async function countPosts(
  searchQuery: string,
  tagFilter: string,
  queryEmbedding?: number[],
  boardId?: string,
) {
  const search = buildPostSearch(searchQuery, queryEmbedding);
  const [row] = await getDb()
    .select({ value: count() })
    .from(posts)
    .where(
      buildPostConditions(await getWorkspaceId(), search, tagFilter, boardId),
    );
  return row.value;
}

// Sprint 21: etiket filtre sekmeleri — en çok kullanılan 8 etiket.
async function loadTagOptions() {
  // Sprint 24 sonrası: limit 8 -> 20 (yeni etiketler sekmelerde görünmez
  // oluyordu); eşit kullanımda alfabetik sıra öngörülebilirlik sağlar.
  return getDb()
    .select({ name: tags.name, count: count(postTags.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .where(eq(tags.workspaceId, await getWorkspaceId()))
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.id)), asc(tags.name))
    .limit(20);
}
