"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { CommentCountBadge } from "@/components/custom/comment-count-badge";

// Sprint 53 (Platformlaşma #3) — roadmap drag-and-drop. Sadece ADMIN için
// aktif: kartları kolonlar arasında sürükleyerek durum değiştirir
// (PATCH /api/admin/posts; admin auth + post/status.changed + history).
// Ziyaretçi için salt-okunur kanban. Native HTML5 drag&drop — yeni
// bağımlılık yok. Optimistik güncelleme + hata durumunda geri alma.

export interface RoadmapColumnPost {
  id: string;
  title: string;
  status: string;
  description: string;
  voteCount: number;
  commentCount: number;
}

export interface RoadmapColumnDef {
  status: string;
  title: string;
  dotClass: string;
  isShipped?: boolean;
}

export function RoadmapColumns({
  columns,
  posts,
  isAdmin,
}: {
  columns: RoadmapColumnDef[];
  posts: RoadmapColumnPost[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  // Optimistik sürüm: {postId: status} — sürükleme hedefine taşımada kullanılır.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function effectiveStatus(post: RoadmapColumnPost): string {
    return overrides[post.id] ?? post.status;
  }

  async function moveTo(postId: string, newStatus: string) {
    setError(null);
    const prev = overrides[postId];
    // Optimistik: hedef kolonda göster.
    setOverrides((o) => ({ ...o, [postId]: newStatus }));
    setBusyId(postId);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status: newStatus }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Durum güncellenemedi.");
      }
      // Kalıcı oldu; router.refresh ile sunucu verisini tazele.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Durum güncellenemedi.");
      // Geri al.
      setOverrides((o) => {
        const next = { ...o };
        if (prev === undefined) delete next[postId];
        else next[postId] = prev;
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  const byStatus = (status: string) =>
    posts.filter((p) => effectiveStatus(p) === status);

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {columns.map((column) => {
        const columnPosts = byStatus(column.status);
        return (
          <section
            key={column.status}
            className="grid content-start gap-3"
            onDragOver={(event) => {
              // Admin değilse sürüklemeye izin verme.
              if (!isAdmin) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              if (!isAdmin) return;
              event.preventDefault();
              const postId = event.dataTransfer.getData("text/plain");
              if (!postId || postId === column.status) return;
              void moveTo(postId, column.status);
            }}
          >
            <h2 className="flex items-center justify-between text-lg font-semibold">
              <span className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${column.dotClass}`}
                  aria-hidden="true"
                />
                {column.title}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {columnPosts.length}
              </span>
            </h2>

            {columnPosts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Bu kolonda henüz fikir yok.
                <Link
                  href="/portal"
                  className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
                >
                  Portaldan fikir öner →
                </Link>
              </div>
            ) : (
              columnPosts.map((post) => (
                <Card
                  key={post.id}
                  draggable={isAdmin}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", post.id);
                  }}
                  className={isAdmin ? "cursor-grab active:cursor-grabbing" : undefined}
                >
                  <CardHeader>
                    <CardTitle className="text-base leading-snug">
                      <Link
                        href={`/portal/${post.id}`}
                        className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <StatusBadge status={effectiveStatus(post)} />
                      <span>{post.voteCount} oy</span>
                      <CommentCountBadge
                        postId={post.id}
                        count={post.commentCount}
                      />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {post.description}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        );
      })}

      {busyId && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-sm">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          Güncelleniyor…
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 left-4 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
