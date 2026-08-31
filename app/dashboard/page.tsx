import { redirect } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { count, desc, eq } from "drizzle-orm";

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
import { posts, votes } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Fikirler</CardTitle>
          <CardDescription>
            {loadError
              ? "Liste yüklenemedi."
              : `Toplam ${rows.length} fikir — durumu satırdan değiştirebilirsin.`}
          </CardDescription>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Oy</TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead className="w-[150px]">Tarih</TableHead>
                  <TableHead className="w-[170px] text-right">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">
                      {post.voteCount}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[420px] truncate font-medium">
                        {post.title}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {post.id}
                      </div>
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
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(200);
}
