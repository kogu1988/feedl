import Link from "next/link";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { WidgetPostForm } from "@/components/custom/widget-post-form";
import { WidgetVoteButton } from "@/components/custom/widget-vote-button";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { posts, votes } from "@/lib/db/schema";
import { buildPostSearch } from "@/lib/post-search";
import { summarize } from "@/lib/post-format";
import { getWidgetSession } from "@/lib/widget/jwt";

// Widget sayfası (plan.md Sprint 32): müşteri sitelerine gömülen iframe'in
// içi. (main) layout'unu KULLANMAZ — root layout bare html/body verir, site
// üst barı iframe'e sızmaz. Kimlik Clerk değil widget çerezinden gelir;
// çerez yoksa liste salt-okunur izlenir.
export const dynamic = "force-dynamic";

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const search = buildPostSearch(q);

  const session = await getWidgetSession();
  const sessionUserId = session?.userId ?? "";

  type WidgetRow = {
    id: string;
    title: string;
    description: string;
    status: string;
    voteCount: number;
    voted: number;
  };
  let rows: WidgetRow[] = [];
  let loadError = false;

  try {
    const result = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        voteCount: count(votes.id),
        voted: sql<number>`count(${votes.id}) filter (where ${votes.userId} = ${sessionUserId})`,
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          isNull(posts.mergedIntoId),
          search.condition,
        ),
      )
      .groupBy(posts.id)
      .orderBy(
        // Arama varken alaka önce gelir; aksi halde portal varsayılanı
        // gibi en çok oylanan üstte (plan.md Sprint 12).
        ...(search.tokens.length > 0
          ? [desc(search.score), desc(sql`count(${votes.id})`)]
          : [desc(sql`count(${votes.id})`)]),
        desc(posts.createdAt),
      )
      .limit(50);
    rows = result.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      voteCount: Number(row.voteCount),
      voted: Number(row.voted),
    }));
  } catch (err) {
    console.error(
      "Widget page list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-bold tracking-tight">Geri Bildirim</h1>
        <Link
          href="/portal"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Tümünü gör
        </Link>
      </div>

      <form action="/widget" method="get" className="mt-3 flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Fikirlerde ara..."
          aria-label="Fikirlerde ara"
          maxLength={100}
        />
        <Button type="submit" variant="outline" size="sm" className="shrink-0">
          Ara
        </Button>
      </form>

      {session ? (
        <div className="mt-3">
          <WidgetPostForm />
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          Fikir gönderebilmek ve oy verebilmek için uygulamanız üzerinden
          giriş yapmanız gerekir. Mevcut fikirleri aşağıdan inceleyebilirsiniz.
        </p>
      )}

      {loadError ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Fikirler yüklenemedi. Lütfen tekrar deneyin.
        </p>
      ) : q ? (
        <p className="mt-4 text-xs text-muted-foreground">
          &quot;{q}&quot; için {rows.length} sonuç
          {" · "}
          <Link
            href="/widget"
            className="underline underline-offset-2 hover:text-foreground"
          >
            aramayı temizle
          </Link>
        </p>
      ) : null}

      <ul className="mt-3 grid gap-2 pb-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-2.5 rounded-lg border p-3"
          >
            <WidgetVoteButton
              postId={row.id}
              initialCount={row.voteCount}
              initialVoted={row.voted > 0}
              authenticated={Boolean(session)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{row.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {summarize(row.description, 120)}
              </p>
              <div className="mt-2">
                <StatusBadge status={row.status} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!loadError && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {q ? "Aramanla eşleşen fikir yok." : "Henüz fikir yok. İlk gönderen sen ol!"}
        </p>
      ) : null}
    </main>
  );
}
