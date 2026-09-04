import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowLeftIcon, MegaphoneIcon } from "lucide-react";

import { ChangelogSubscribeForm } from "@/components/custom/changelog-subscribe-form";
import { MarkdownContent } from "@/components/custom/markdown-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
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

export const metadata = {
  title: "Changelog — feedl",
  description: "Yeni özellikler, iyileştirmeler ve düzeltmeler.",
};

const labelStyles: Record<string, string> = {
  yeni: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  iyileştirme: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  düzeltme: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default async function ChangelogPage() {
  let entries: Awaited<ReturnType<typeof loadEntries>> = [];
  let loadError = false;
  try {
    entries = await loadEntries();
  } catch (err) {
    console.error(
      "Changelog page load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  // Abonelik kutusunda e-posta ön-dolu: girişli kullanıcının feedl'deki
  // e-postası (Clerk webhook ile senkron). Lookup başarısızsa alan boş kalır.
  let defaultEmail: string | undefined;
  try {
    const { userId } = await auth();
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
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Portala dön
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <MegaphoneIcon className="size-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Changelog</h1>
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
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Duyurular yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Henüz duyuru yok — ilk güncelleme burada duyurulacak.
          </p>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {trDateTimeFormatter.format(entry.publishedAt)}
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
                <h2 className="text-lg font-semibold leading-snug">
                  <Link
                    href={`/portal/changelog/${entry.id}`}
                    className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {entry.title}
                  </Link>
                </h2>
              </CardHeader>
              <CardContent className="grid gap-4">
                {entry.imageUrl ? (
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

// İki aşamalı yükleme: duyurular, sonra hepsinin post linkleri tek sorguda
// (fan-out yok). Post başlığı için posts join'i yeterli; silinen fikirlerde
// link cascade ile gider, eksik kayıt oluşmaz.
async function loadEntries() {
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
    .where(eq(changelogEntries.workspaceId, await getWorkspaceId()))
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
    linkedPosts: postsByEntry.get(row.id) ?? [],
  }));
}
