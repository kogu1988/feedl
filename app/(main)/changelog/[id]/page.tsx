import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { MarkdownContent } from "@/components/custom/markdown-content";
import { PageBreadcrumb } from "@/components/custom/page-breadcrumb";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { changelogEntries, changelogPostLinks, posts } from "@/lib/db/schema";
import { trDateTimeFormatter } from "@/lib/post-format";

// Sprint 40: changelog detay sayfası — markdown gövde + kapak görseli +
// ilgili fikirler. Liste sayfasındaki kart başlıkları buraya bağlanır.

const labelStyles: Record<string, string> = {
  yeni: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  iyileştirme: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  düzeltme: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

async function loadEntry(id: string) {
  const workspaceId = await getWorkspaceId();
  const [entry] = await getDb()
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
        eq(changelogEntries.id, id),
        eq(changelogEntries.workspaceId, workspaceId),
        eq(changelogEntries.status, "published"),
      ),
    )
    .limit(1);

  if (!entry) {
    return null;
  }

  const linkRows = await getDb()
    .select({
      postId: posts.id,
      postTitle: posts.title,
    })
    .from(changelogPostLinks)
    .innerJoin(posts, eq(posts.id, changelogPostLinks.postId))
    .where(eq(changelogPostLinks.entryId, id));

  return { ...entry, linkedPosts: linkRows };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return { title: "Duyuru — feedl" };
  }
  try {
    const entry = await loadEntry(id);
    if (!entry) {
      return { title: "Duyuru bulunamadı — feedl" };
    }
    return {
      title: `${entry.title} — feedl`,
      description: entry.body.slice(0, 160),
    };
  } catch {
    return { title: "Duyuru — feedl" };
  }
}

export default async function ChangelogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  let entry: Awaited<ReturnType<typeof loadEntry>> = null;
  let loadError = false;
  try {
    entry = await loadEntry(id);
  } catch (err) {
    console.error(
      "Changelog detail load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  if (!loadError && !entry) {
    notFound();
  }

  // Vitrin modu: feedl kök hostundaki ziyaretçiye demo yüzey etkileşimsiz
  // sunulur (ilgili fikir linkleri inert). Müşteri subdomainleri etkilenmez.
  const { userId } = await auth();
  const showcaseMode = (await isShowcaseRequest()) && !userId;

  return (
    <main
      className="container mx-auto max-w-6xl p-4 sm:p-8"
      inert={showcaseMode || undefined}
    >
      <PageBreadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "Güncellemeler", href: "/changelog" },
          { label: entry?.title ?? "Duyuru" },
        ]}
      />

      {entry ? (
        <article className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {entry.publishedAt ? trDateTimeFormatter.format(entry.publishedAt) : ""}
            </span>
            {entry.label ? (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                  labelStyles[entry.label] ??
                  "border-border bg-muted text-muted-foreground"
                }`}
              >
                {entry.label}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight leading-snug">{entry.title}</h1>

          {entry.imageUrl ? (
            // Harici CDN görseli; boyut bilinmez → next/image yerine <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.imageUrl}
              alt=""
              className="mt-5 max-h-96 w-full rounded-lg border object-cover"
            />
          ) : null}

          <div className="mt-5 max-w-prose">
            <MarkdownContent content={entry.body} />
          </div>

          {entry.linkedPosts.length > 0 ? (
            <div className="mt-6 grid gap-1.5 rounded-md border bg-muted/40 p-3">
              <span className="text-xs font-medium text-muted-foreground">
                İlgili fikirler:
              </span>
              {entry.linkedPosts.map((post) => (
                <Link
                  key={post.postId}
                  href={`/portal/${post.postId}`}
                  className="text-sm underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {post.postTitle}
                </Link>
              ))}
            </div>
          ) : null}
        </article>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <h1 className="text-lg font-semibold">Duyuru yüklenemedi</h1>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sayfayı yenilemeyi dene.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
