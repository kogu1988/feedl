import { desc } from "drizzle-orm";
import { Show, SignInButton } from "@clerk/nextjs";

import { NewPostDialog } from "@/components/custom/new-post-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";

// Canlı liste: her istekte DB'den okunur, build zamanında dondurulmaz.
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function summarize(text: string, maxLength = 160) {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

const statusLabels: Record<string, string> = {
  open: "Açık",
  planned: "Planlandı",
  "in-progress": "Geliştiriliyor",
  shipped: "Yayınlandı",
};

export default async function PortalPage() {
  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let loadError = false;

  try {
    rows = await loadPosts();
  } catch (err) {
    console.error(
      "Portal list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fikir Portalı</h1>
          <p className="mt-2 text-muted-foreground">
            Özellik isteklerini paylaş, başkalarının fikirlerini oku.
          </p>
        </div>

        <Show when="signed-in">
          <NewPostDialog />
        </Show>
        <Show when="signed-out">
          <SignInButton>
            <button className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Fikir göndermek için giriş yap
            </button>
          </SignInButton>
        </Show>
      </div>

      <div className="mt-8 grid gap-4">
        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">Henüz fikir yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              İlk fikri sen gönder; ürün yol haritası buradan başlıyor.
            </p>
          </div>
        ) : (
          rows.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="leading-snug">{post.title}</CardTitle>
                  <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {statusLabels[post.status] ?? post.status}
                  </span>
                </div>
                <CardDescription>
                  {dateFormatter.format(post.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {summarize(post.description)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

async function loadPosts() {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(100);
}
