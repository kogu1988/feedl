"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkPlusIcon, Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SavedViewItem {
  id: string;
  name: string;
  params: string;
}

// Sprint 22: kayıtlı görünüm çubuğu — mevcut filtre kombinasyonunu adla
// kaydet, kayıtlı görünümlere tek tıkla git, gereksiz olanı sil.
export function SavedViewBar({
  views,
  currentParams,
}: {
  views: SavedViewItem[];
  currentParams: Record<string, string>;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasActiveFilters = Object.keys(currentParams).length > 0;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Görünüm adı gerekli.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          params: new URLSearchParams(currentParams).toString(),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Görünüm kaydedilemedi.");
        return;
      }
      setName("");
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/views?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Görünüm silinemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  };

  const busy = isSaving || isPending || deletingId !== null;

  return (
    <div className="grid gap-2">
      {views.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {views.map((view) => (
            <span
              key={view.id}
              className="inline-flex items-center overflow-hidden rounded-full border"
            >
              <Link
                href={`/dashboard?${view.params}`}
                className="px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                {view.name}
              </Link>
              <button
                type="button"
                onClick={() => void remove(view.id)}
                disabled={busy}
                className="cursor-pointer border-l px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label={`${view.name} görünümünü sil`}
              >
                {deletingId === view.id ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <XIcon className="size-3" aria-hidden="true" />
                )}
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={
            hasActiveFilters
              ? "Bu filtre kombinasyonuna ad ver..."
              : "Filtre seçtikten sonra kaydedebilirsin"
          }
          disabled={!hasActiveFilters || busy}
          className="h-8 max-w-64 text-xs"
          aria-label="Görünüm adı"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void save()}
          disabled={!hasActiveFilters || busy}
        >
          {isSaving ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <BookmarkPlusIcon className="size-4" aria-hidden="true" />
          )}
          Görünümü kaydet
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
