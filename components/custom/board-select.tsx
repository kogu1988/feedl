"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Admin fikir tablosunda satır içi board seçici. Seçim PATCH /api/admin/posts
// (postId + boardId) gönderir; sayfa sunucu verisiyle tazelenir.

export interface BoardSelectOption {
  id: string;
  name: string;
}

export function BoardSelect({
  postId,
  boardId,
  options,
}: {
  postId: string;
  boardId: string | null;
  options: BoardSelectOption[];
}) {
  const [value, setValue] = useState(boardId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const current = value ?? boardId ?? "";

  async function move(next: string) {
    const nextId = next || null;
    if (nextId === boardId) return;
    setError(null);
    setBusy(true);
    setValue(next);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, boardId: nextId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setValue(boardId ?? "");
        setError(json.error ?? "Board güncellenemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setValue(boardId ?? "");
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  if (options.length <= 1) {
    return (
      <span className="text-xs text-muted-foreground">
        {options[0]?.name ?? "—"}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <select
        value={current}
        disabled={busy || isPending}
        onChange={(event) => void move(event.target.value)}
        aria-label="Board"
        className="h-8 w-[150px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
