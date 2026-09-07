import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { MegaphoneIcon } from "lucide-react";

import { ChangelogSubscribeForm } from "@/components/custom/changelog-subscribe-form";
import { EmptyState } from "@/components/custom/empty-state";
import { Notice } from "@/components/custom/notice";
import { MarkdownContent } from "@/components/custom/markdown-content";
import { PageBreadcrumb } from "@/components/custom/page-breadcrumb";
import { IdeaCard } from "@/components/custom/idea-card";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/db";
import { PoweredByFeedl } from "@/components/custom/powered-by-feedl";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { generateCanonical } from "@/lib/seo";
import { unstable_cache } from "next/cache";
import {
  changelogEntries,
  changelogPostLinks,
  posts,
  users,
} from "@/lib/db/schema";
import { trDateTimeFormatter } from "@/lib/post-format";

// Sprint 25: public changelog — roadmap'ten bağımsız duyuru akışı
// (Canny changelog modeli). Herkes okuyabilir; yazma yalnızca admin.
export const dynamic = "force-dynamic";

// F2: statik metadata + server-side canonical (tam path üreten).
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Changelog — feedl",
    description: "Yeni özellikler, iyileştirmeler ve düzeltmeler.",
    ...canonical,
  };
}

const labelStyles: Record<string, string> = {
  yeni: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  iyileştirme: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  düzeltme: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default async function ChangelogPage() {
  let entries: Awaited<ReturnType<typeof loadEntries>> = [];
  let loadError = false;
  try {
    const workspaceId = await getWorkspaceId();
    entries = await loadEntries(workspaceId);
  } catch (err) {
    console.error(
      "Changelog page load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  // Abonelik kutusunda e-posta ön-dolu: girişli kullanıcının feedl'deki
  // e-postası (Clerk webhook ile senkron). Lookup başarısızsa alan boş kalır.
  const { userId } = await auth();
  // Vitrin modu: feedl kök hostundaki ziyaretçiye demo yüzey etkileşimsiz
  // sunulur (abonelik formu + linkler inert). Girişli kullanıcı için gerçek
  // kullanım; müşteri subdomainleri hiç vitrin değildir.
  const showcaseMode = (await isShowcaseRequest()) && !userId;
  let defaultEmail: string | undefined;
  try {
    if (userId) {
      const [row] = await getDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      defaultEmail = row?.email;
    }
  } catch {
    defaultEmail = undefined;
  }

  return (
    <main
      className="container mx-auto max-w-6xl p-4 sm:p-8"
      inert={showcaseMode || undefined}
    >
      <PageBreadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "Güncellemeler" },
        ]}
      />

      <div className="mt-6 flex items-center gap-2">
        <MegaphoneIcon className="size-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Yeni özellikler, iyileştirmeler ve düzeltmeler — en yeniden.
      </p>

      <div className="mt-6 rounded-lg border bg-muted/40 p-4">
        <h2 className="text-sm font-medium">Yeni duyurular için abone ol.</h2>
        <div className="mt-3">
          <ChangelogSubscribeForm defaultEmail={defaultEmail} />
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {loadError ? (
          <Notice size="md">
            Duyurular yüklenemedi. Sayfayı yenilemeyi dene.
          </Notice>
        ) : entries.length === 0 ? (
          <EmptyState>
            Henüz duyuru yok — ilk güncelleme burada duyurulacak.
          </EmptyState>
        ) : (
          entries.map((entry) => (
            <IdeaCard
              key={entry.id}
              title={entry.title}
              href={`/changelog/${entry.id}`}
              date={entry.dateLabel}
              badges={
                entry.label ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      labelStyles[entry.label] ??
                        "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {entry.label}
                  </span>
                ) : null
              }
              content={
                <div className="grid gap-4">
                  {entry.imageUrl ? (
                    // Harici CDN görseli; boyut bilinmez → next/image yerine <img>.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.imageUrl}
                      alt=""
                      className="max-h-80 w-full rounded-md border object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <MarkdownContent content={entry.body} />
                  {entry.linkedPosts.length > 0 ? (
                    <div className="grid gap-1.5 rounded-md border bg-muted/40 p-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        İlgili fikirler:
                      </span>
                      {entry.linkedPosts.map((post) => (
                        <Link
                          key={post.id}
                          href={`/portal/${post.id}`}
                          className="text-sm underline-offset-4 transition-colors hover:text-primary hover:underline"
                        >
                          {post.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
          ))
        )}
      </div>
      <PoweredByFeedl />
    </main>
  );
}

// İki aşamalı yükleme: duyurular, sonra hepsinin post linkleri tek sorguda
// (fan-out yok). Post başlığı için posts join'i yeterli; silinen fikirlerde
// link cascade ile gider, eksik kayıt oluşmaz.
// Sprint 63x (public-read cache): workspace'le anahtarlı `unstable_cache` —
// her istekte DB yerine 60s cache. `changelog` tag'i, yayınlama/duyuru
// güncellenince `revalidateTag("changelog")` ile anında tazelenir.
const loadEntries = unstable_cache(
  async (workspaceId: string) => {
    const rows = await getDb()
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        body: changelogEntries.body,
        imageUrl: changelogEntries.imageUrl,
        label: changelogEntries.label,
        publishedAt: changelogEntries.publishedAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.workspaceId, workspaceId),
          eq(changelogEntries.status, "published"),
        ),
      )
      .orderBy(desc(changelogEntries.publishedAt))
      .limit(50);

    if (rows.length === 0) {
      return [];
    }

    const linkRows = await getDb()
      .select({
        entryId: changelogPostLinks.entryId,
        postId: posts.id,
        postTitle: posts.title,
      })
      .from(changelogPostLinks)
      .innerJoin(posts, eq(posts.id, changelogPostLinks.postId))
      .where(
        inArray(
          changelogPostLinks.entryId,
          rows.map((row) => row.id),
        ),
      );

    const postsByEntry = new Map<string, { id: string; title: string }[]>();
    for (const link of linkRows) {
      const list = postsByEntry.get(link.entryId) ?? [];
      list.push({ id: link.postId, title: link.postTitle });
      postsByEntry.set(link.entryId, list);
    }

    return rows.map((row) => ({
      ...row,
      // publishedAt bir Date; `unstable_cache` JSON ile string'e çevirir ve
      // Intl.DateTimeFormat.format(string) `RangeError: Invalid time value`
      // fırlatır (Sprint 63x regresyonu). Bu yüzden tarihi cache İÇİNDE
      // string'e çevirip render'a hazır etiket veriyoruz.
      dateLabel: row.publishedAt
        ? trDateTimeFormatter.format(row.publishedAt)
        : undefined,
      linkedPosts: postsByEntry.get(row.id) ?? [],
    }));
  },
  ["changelog", "ws"],
  { revalidate: 60, tags: ["changelog"] },
);
