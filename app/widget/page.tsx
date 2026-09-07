import Link from "next/link";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import { Notice } from "@/components/custom/notice";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { WidgetPostForm } from "@/components/custom/widget-post-form";
import { WidgetVoteButton } from "@/components/custom/widget-vote-button";
import { WidgetTriage } from "@/components/custom/widget-triage";
import { getDb } from "@/lib/db";
import {
  getWorkspaceId,
  resolveWorkspaceIdFromSlug,
  getWorkspaceBrand,
} from "@/lib/db/workspace";
import { getWidgetSubmissionSettings } from "@/lib/widget/submission";
import { planFromString } from "@/lib/paddle";
import { posts, votes, workspaces } from "@/lib/db/schema";
import { buildPostSearch } from "@/lib/post-search";
import { summarize } from "@/lib/post-format";
import { cn } from "@/lib/utils";
import { getWidgetSession } from "@/lib/widget/jwt";

// Widget sayfası (plan.md Sprint 32): müşteri sitelerine gömülen iframe'in
// içi. (main) layout'unu KULLANMAZ — root layout bare html/body verir, site
// üst barı iframe'e sızmaz. Kimlik Clerk değil widget çerezinden gelir;
// çerez yoksa liste salt-okunur izlenir.
// Sprint 41: embed script'ten gelen ?theme=light|dark|auto parametresi html
// elementine .dark class'ı olarak uygulanır (varsayılan light).
export const dynamic = "force-dynamic";

const WIDGET_THEMES = ["light", "dark", "auto"] as const;
type WidgetTheme = (typeof WIDGET_THEMES)[number];

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; theme?: string; ws?: string; page?: string; sort?: string }>;
}) {
  const { q: rawQ, theme: rawTheme, ws: rawWs, page: rawPage, sort: rawSort } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  // Sprint 63z: sayfalama (5'er) + sıralama (en yeni / en çok oy).
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const PAGE_SIZE = 5;
  const sort = rawSort === "new" ? "new" : "votes"; // varsayılan: en çok oy
  const offset = (page - 1) * PAGE_SIZE;
  // Sprint 63p: `?ws=<slug>` varsa workspace'i ondan çöz (token olmayan
  // salt-okunur iframe de müşteri workspace'ini görsün); yoksa oturum/host.
  const workspaceId =
    (await resolveWorkspaceIdFromSlug(rawWs)) ?? (await getWorkspaceId());
  // "Tümünü gör" müşterinin PORTALINA gider. Önce custom domain (varsa),
  // sonra subdomain (acme.feedl.app/portal), en son default /portal.
  const brand = await getWorkspaceBrand();
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app").replace(/^https?:\/\//, "");
  const portalHref =
    brand.customDomain
      ? `https://${brand.customDomain}/portal`
      : rawWs && rawWs !== "feedl"
        ? `https://${rawWs}.${appHost}/portal`
        : "/portal";
  const theme: WidgetTheme = WIDGET_THEMES.includes(
    rawTheme as WidgetTheme,
  )
    ? (rawTheme as WidgetTheme)
    : "light";
  const search = buildPostSearch(q);

  const session = await getWidgetSession();
  const sessionUserId = session?.userId ?? "";

  // Sprint 63z: workspace'e göre gönderim modu + anonim oy bayrağını çöz
  // (client bileşenlere geçir; anonim modda oturum gerekmez).
  const { mode, anonymousVoting } = await getWidgetSubmissionSettings(workspaceId);
  const canVote = Boolean(session) || (mode === "anonymous" && anonymousVoting);

  // Triage Pro özelliği: free'de "Pro" rozetiyle gösterilir (anlaşılsın).
  let isPro = false;
  try {
    const [wsRow] = await getDb()
      .select({ plan: workspaces.plan })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    isPro = planFromString(wsRow?.plan) === "pro";
  } catch {
    isPro = false;
  }

  type WidgetRow = {
    id: string;
    title: string;
    description: string;
    status: string;
    voteCount: number;
    voted: number;
  };
  let rows: WidgetRow[] = [];
  let total = 0;
  let loadError = false;

  // Toplam fikir sayısı (sayfalama). Arama koşuluyla birebir aynı.
  try {
    const [countRow] = await getDb()
      .select({ value: count() })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, workspaceId),
          isNull(posts.mergedIntoId),
          search.condition,
        ),
      );
    total = Number(countRow?.value ?? 0);
  } catch (err) {
    console.error(
      "Widget page count failed:",
      err instanceof Error ? err.message : err,
    );
  }

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
          eq(posts.workspaceId, workspaceId),
          isNull(posts.mergedIntoId),
          search.condition,
        ),
      )
      .groupBy(posts.id)
      .orderBy(
        // Sprint 63z: sort=new → en yeni; sort=votes (varsayılan) → en çok oy.
        // Arama varken alaka her zaman önce gelir.
        ...(search.tokens.length > 0
          ? [desc(search.score)]
          : sort === "new"
            ? [desc(posts.createdAt), desc(sql`count(${votes.id})`)]
            : [desc(sql`count(${votes.id})`), desc(posts.createdAt)]),
      )
      .limit(PAGE_SIZE)
      .offset(offset);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Sayfa URL'si: tema + ws + sort + (q varsa) korunur; page değişir.
  function pageHref(nextPage: number): string {
    const params = new URLSearchParams();
    if (theme !== "light") params.set("theme", theme);
    if (rawWs) params.set("ws", rawWs);
    params.set("sort", sort);
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    return `/widget?${params.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      {theme !== "light" ? (
        <script
          // Hydration'dan önce çalışır; auto modda işletim sistemi tercihini
          // izler ve değişiklikte class'ı günceller.
          dangerouslySetInnerHTML={{
            __html:
              theme === "dark"
                ? 'document.documentElement.classList.add("dark");'
                : '(function(){var el=document.documentElement;var mq=window.matchMedia("(prefers-color-scheme: dark)");function a(v){el.classList.toggle("dark",v)}a(mq.matches);if(mq.addEventListener)mq.addEventListener("change",function(e){a(e.matches)});else if(mq.addListener)mq.addListener(function(e){a(e.matches)})})();',
          }}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-bold tracking-tight">Geri Bildirim</h1>
        <Link
          href={portalHref}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Tümünü gör
        </Link>
      </div>

      {/* Sprint 63z: arama formu — tema/ws/sort korunur. */}
      <form action="/widget" method="get" className="mt-3 flex gap-2">
        {theme !== "light" ? (
          <input type="hidden" name="theme" value={theme} />
        ) : null}
        {rawWs ? <input type="hidden" name="ws" value={rawWs} /> : null}
        <input type="hidden" name="sort" value={sort} />
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
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">Sırala:</span>
        <div className="inline-flex rounded-md border border-input">
          <Link
            href={pageHref(1).replace(/sort=[^&]*/, "sort=votes")}
            className={cn(
              "rounded-l-md px-2.5 py-1 transition-colors",
              sort === "votes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            En çok oy
          </Link>
          <Link
            href={pageHref(1).replace(/sort=[^&]*/, "sort=new")}
            className={cn(
              "rounded-r-md px-2.5 py-1 transition-colors",
              sort === "new"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            En yeni
          </Link>
        </div>
      </div>

      {/* Sprint 63z: gönderim alanı — anonim bilgi kutusu + form + triage. */}
      <div className="mt-4 grid gap-2">
        {!session ? (
          <Notice tone="info" size="md">
            {mode === "anonymous"
              ? "Üye olmadan fikir gönderebilir ve oy verebilirsiniz."
              : "Fikir gönderebilmek ve oy verebilmek için uygulamanız üzerinden giriş yapmanız gerekir. Mevcut fikirleri aşağıdan inceleyebilirsiniz."}
          </Notice>
        ) : null}
        <WidgetPostForm submissionMode={mode} ws={rawWs} authenticated={Boolean(session)} />
        <WidgetTriage ws={rawWs} isPro={isPro} />
      </div>

      {loadError ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Fikirler yüklenemedi. Lütfen tekrar deneyin.
        </p>
      ) : q ? (
        <p className="mt-4 text-xs text-muted-foreground">
          &quot;{q}&quot; için {total} sonuç
          {" · "}
          <Link
            href={pageHref(1).replace(/sort=[^&]*/, "sort=votes").replace(/page=\d+/, "page=1")}
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
              authenticated={canVote}
              ws={rawWs}
            />
            <div className="min-w-0 flex-1">
              {/* Sprint 63z: tıklayınca fikrin portal detayına gider. */}
              <Link
                href={`${portalHref}/${row.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium leading-snug underline-offset-2 hover:text-primary hover:underline"
              >
                {row.title}
              </Link>
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

      {/* Sprint 63z: sayfalama (5'er). */}
      {totalPages > 1 ? (
        <nav className="mt-3 flex items-center justify-between gap-2 text-xs" aria-label="Sayfalama">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="inline-flex rounded-md border border-input px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              &larr; Önceki
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="inline-flex rounded-md border border-input px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sonraki &rarr;
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState>
          {q ? "Aramanla eşleşen fikir yok." : "Henüz fikir yok. İlk gönderen sen ol!"}
        </EmptyState>
      ) : null}
    </main>
  );
}
