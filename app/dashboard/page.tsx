import { redirect } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { count, desc, eq, inArray, asc } from "drizzle-orm";

import { FilterTabs } from "@/components/custom/filter-tabs";
import { PostsTable } from "@/components/custom/posts-table";
import { SavedViewBar } from "@/components/custom/saved-view-bar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import {
  postStatusEnum,
  postTags,
  posts,
  savedViews,
  tags,
  votes,
} from "@/lib/db/schema";
import { statusLabels } from "@/lib/post-format";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tag?: string }>;
}) {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  // plan.md Sprint 12: durum filtresi ?status= ile gelir; geçersiz değer
  // "Tümü"ne düşer. İstatistikler her zaman TÜM fikirlerden hesaplanır,
  // filtre yalnızca tabloyu etkiler.
  const { status: rawStatus, tag: rawTag } = await searchParams;
  const statusFilter =
    postStatusEnum.enumValues.find((value) => value === rawStatus) ?? null;
  // Sprint 21: etiket filtresi (portal ile aynı normalize kuralı).
  const tagFilter = (rawTag ?? "").trim().toLocaleLowerCase("tr").slice(0, 30);

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let tagOptions: Awaited<ReturnType<typeof loadTagOptions>> = [];
  let views: Awaited<ReturnType<typeof loadSavedViews>> = [];
  let loadError = false;

  try {
    rows = await loadPosts(tagFilter);
    tagOptions = await loadTagOptions();
    views = await loadSavedViews();
  } catch (err) {
    console.error(
      "Dashboard list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  const visibleRows = statusFilter
    ? rows.filter((row) => row.status === statusFilter)
    : rows;

  // İstatistik satırı (plan.md Sprint 11): tek sorgudan JS tarafında hesaplanır.
  const totalVotes = rows.reduce((sum, row) => sum + row.voteCount, 0);
  const openCount = rows.filter((row) => row.status === "open").length;
  const shippedCount = rows.filter((row) => row.status === "shipped").length;

  const stats = [
    { label: "Toplam Fikir", value: rows.length },
    { label: "Toplam Oy", value: totalVotes },
    { label: "Açık (bekleyen)", value: openCount },
    { label: "Yayınlanan", value: shippedCount },
  ];

  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Paneli</h1>
          <p className="mt-2 text-muted-foreground">
            Fikirleri incele, durumlarını güncelleyerek yol haritasını yönet.
          </p>
        </div>

        <a
          href="/api/admin/export"
          download
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <DownloadIcon className="size-4" aria-hidden="true" />
          CSV İndir
        </a>
      </div>

      {!loadError ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Fikirler</CardTitle>
          <CardDescription>
            {loadError
              ? "Liste yüklenemedi."
              : statusFilter
                ? `Filtrede ${visibleRows.length} / toplam ${rows.length} fikir — durumu satırdan değiştirebilirsin.`
                : `Toplam ${rows.length} fikir — durumu satırdan değiştirebilirsin.`}
          </CardDescription>
          {!loadError && rows.length > 0 ? (
            <div className="grid gap-2 pt-2">
              <FilterTabs
                paramName="status"
                basePath="/dashboard"
                active={statusFilter ?? ""}
                extraParams={tagFilter ? { tag: tagFilter } : undefined}
                options={[
                  { value: "", label: "Tümü" },
                  ...postStatusEnum.enumValues.map((value) => ({
                    value,
                    label: statusLabels[value] ?? value,
                  })),
                ]}
              />
              {tagOptions.length > 0 ? (
                <FilterTabs
                  paramName="tag"
                  basePath="/dashboard"
                  active={tagFilter}
                  extraParams={
                    statusFilter ? { status: statusFilter } : undefined
                  }
                  options={[
                    { value: "", label: "Tüm Etiketler" },
                    ...tagOptions.map((option) => ({
                      value: option.name,
                      label: `#${option.name} (${option.count})`,
                    })),
                  ]}
                />
              ) : null}
              <SavedViewBar
                views={views}
                currentParams={Object.fromEntries(
                  [
                    ["status", statusFilter],
                    ["tag", tagFilter],
                  ].filter(
                    (pair): pair is [string, string] =>
                      pair[1] !== null && pair[1] !== "",
                  ),
                )}
              />
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Henüz fikir yok. Portala gönderilen ilk fikir burada görünecek.
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Bu durumda fikir yok.
            </p>
          ) : (
            <PostsTable
              rows={visibleRows.map((row) => ({
                id: row.id,
                title: row.title,
                status: row.status,
                postType: row.postType,
                mergedIntoId: row.mergedIntoId,
                sentimentLabel: row.sentimentLabel,
                aiKeywords: row.aiKeywords,
                createdAtLabel: dateFormatter.format(row.createdAt),
                voteCount: row.voteCount,
              }))}
              tagOptions={tagOptions.map((option) => ({
                id: option.id,
                name: option.name,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Sprint 21: ?tag= filtresi — birleşmiş fikirler dahil (admin görür).
async function loadPosts(tagFilter: string) {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      postType: posts.postType,
      mergedIntoId: posts.mergedIntoId,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(
      tagFilter
        ? inArray(
            posts.id,
            getDb()
              .select({ postId: postTags.postId })
              .from(postTags)
              .innerJoin(tags, eq(tags.id, postTags.tagId))
              .where(eq(tags.name, tagFilter)),
          )
        : undefined,
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(200);
}

// Sprint 21: etiket filtre sekmeleri — en çok kullanılan 8 etiket.
// Sprint 22: id de dönülüyor (bulk etiket işlemi için).
async function loadTagOptions() {
  return getDb()
    .select({ id: tags.id, name: tags.name, count: count(postTags.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.id)), asc(tags.name))
    .limit(20);
}

// Sprint 22: kayıtlı görünümler — en yeniden.
async function loadSavedViews() {
  return getDb()
    .select({
      id: savedViews.id,
      name: savedViews.name,
      params: savedViews.params,
    })
    .from(savedViews)
    .orderBy(desc(savedViews.createdAt))
    .limit(12);
}
