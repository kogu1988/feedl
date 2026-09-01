import { redirect } from "next/navigation";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { count, desc, eq } from "drizzle-orm";

import { KeywordChips } from "@/components/custom/keyword-chips";
import { FilterTabs } from "@/components/custom/filter-tabs";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { StatusSelect } from "@/components/custom/status-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { postStatusEnum, posts, votes } from "@/lib/db/schema";
import { statusLabels } from "@/lib/post-format";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  // plan.md Sprint 12: durum filtresi ?status= ile gelir; geçersiz değer
  // "Tümü"ne düşer. İstatistikler her zaman TÜM fikirlerden hesaplanır,
  // filtre yalnızca tabloyu etkiler.
  const { status: rawStatus } = await searchParams;
  const statusFilter =
    postStatusEnum.enumValues.find((value) => value === rawStatus) ?? null;

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let loadError = false;

  try {
    rows = await loadPosts();
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
            <div className="pt-2">
              <FilterTabs
                paramName="status"
                basePath="/dashboard"
                active={statusFilter ?? ""}
                options={[
                  { value: "", label: "Tümü" },
                  ...postStatusEnum.enumValues.map((value) => ({
                    value,
                    label: statusLabels[value] ?? value,
                  })),
                ]}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Oy</TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead className="w-[200px]">AI</TableHead>
                  <TableHead className="w-[140px]">Tarih</TableHead>
                  <TableHead className="w-[170px] text-right">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium tabular-nums">
                      {post.voteCount}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[360px] truncate font-medium">
                        <Link
                          href={`/portal/${post.id}`}
                          className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                        >
                          {post.title}
                        </Link>
                      </div>
                      {post.mergedIntoId ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Birleştirildi
                        </div>
                      ) : null}
                      <div className="font-mono text-xs text-muted-foreground">
                        {post.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.sentimentLabel ? (
                        <div className="grid gap-1">
                          <SentimentBadge sentiment={post.sentimentLabel} />
                          {post.aiKeywords && post.aiKeywords.length > 0 ? (
                            <KeywordChips keywords={post.aiKeywords} max={2} />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateFormatter.format(post.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusSelect postId={post.id} status={post.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

async function loadPosts() {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      mergedIntoId: posts.mergedIntoId,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(200);
}
