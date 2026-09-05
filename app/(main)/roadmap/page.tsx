import { and, countDistinct, desc, eq, inArray, isNull, or } from "drizzle-orm";
import Link from "next/link";

import { RoadmapColumns } from "@/components/custom/roadmap-columns";
import { getDb } from "@/lib/db";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { getAdminUserId, getSessionUserId } from "@/lib/auth/admin";
import { roadmapStatuses } from "@/lib/post-format";
import { boards, comments, posts, votes } from "@/lib/db/schema";

// Herkese açık yol haritası (plan.md Sprint 8): kanban görünümü —
// Planlandı / Geliştiriliyor / Yayında kolonları, kartlar oy + yorum
// sayısıyla (Sprint 13). Sprint 53: admin girişi varsa drag-and-drop
// (sürükleyerek durum değiştirme) etkin; ziyaretçi salt-okunur.

// Canlı liste: her istekte DB'den okunur, build zamanında dondurulmaz.
export const dynamic = "force-dynamic";

const columnMeta: Record<string, { title: string; dotClass: string }> = {
  planned: { title: "Planlandı", dotClass: "bg-sky-500" },
  "in-progress": { title: "Geliştiriliyor", dotClass: "bg-amber-500" },
  shipped: { title: "Yayında", dotClass: "bg-emerald-500" },
};

export default async function RoadmapPage() {
  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let loadError = false;
  let isAdmin = false;

  try {
    rows = await loadPosts();
    isAdmin = Boolean(await getAdminUserId());
  } catch (err) {
    console.error(
      "Roadmap load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  // Vitrin modu: feedl kök hostundaki ziyaretçiye demo yüzey etkileşimsiz
  // sunulur (kart linkleri + admin sürükleme inert). Girişli kullanıcı için
  // gerçek kullanım; müşteri subdomainleri hiç vitrin değildir.
  const showcaseMode =
    (await isShowcaseRequest()) && !(await getSessionUserId());

  const columns = roadmapStatuses
    .map((status) => ({
      status,
      title: columnMeta[status]?.title ?? status,
      dotClass: columnMeta[status]?.dotClass ?? "bg-muted",
    }));

  return (
    <main
      className="container mx-auto max-w-6xl p-4 sm:p-8"
      inert={showcaseMode || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Yol Haritası</h1>
          <p className="mt-2 text-muted-foreground">
            Hangi özelliklerin planlandığını, geliştirildiğini ve yayınlandığını
            şeffafça takip et.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link
            href="/portal"
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ← Portala dön
          </Link>
          {isAdmin && (
            <span className="text-xs text-muted-foreground">
              Kartları sürükleyerek durumu değiştirebilirsin.
            </span>
          )}
        </div>
      </div>

      {loadError ? (
        <p className="mt-8 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Yol haritası yüklenemedi. Sayfayı yenilemeyi dene.
        </p>
      ) : (
        <RoadmapColumns columns={columns} posts={rows} isAdmin={isAdmin} />
      )}
    </main>
  );
}

async function loadPosts() {
  // Sprint 48c: roadmap yalnızca public board'a ait (veya board'sız) fikirleri
  // gösterir — private board fikirleri yönetici ekranı dışında sızmaz.
  const publicBoardIds = (
    await getDb()
      .select({ id: boards.id })
      .from(boards)
      .where(eq(boards.visibility, "public"))
  ).map((row) => row.id);

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
      and(
        eq(posts.workspaceId, await getWorkspaceId()),
        isNull(posts.mergedIntoId),
        or(
          isNull(posts.boardId),
          inArray(posts.boardId, publicBoardIds),
        ),
      ),
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(100);
}
