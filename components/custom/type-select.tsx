"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { typeLabels } from "@/lib/post-format";

// Sprint 21: fikir türü seçenekleri — etiketler TEK kaynaktan (lib/post-format
// typeLabels). Sıralı liste tutulur, etiketler typeLabels'ten türetilir.
export const TYPE_ORDER = ["feature", "bug", "usability"] as const;

export const POST_TYPE_OPTIONS = TYPE_ORDER.map((value) => ({
  value,
  label: typeLabels[value] ?? value,
}));

// Admin için tür seçici: seçim PATCH /api/admin/posts'e gider
// (postType alanı), sayfa sunucu verisiyle tazelenir.
// Sprint 63w (F4): menü tabanlı DropdownMenu yerine TEK standart native
// <select> kabuğu (StatusSelect/BoardSelect ile aynı görünüm). Tek chevron
// globals.css'teki global select kuralından gelir — çift chevron söz konusu
// olmaz.
export function TypeSelect({
  postId,
  type,
}: {
  postId: string;
  type: string | null;
}) {
  const [current, setCurrent] = useState(type);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const changeType = async (next: string) => {
    if (next === (current ?? "")) return;
    setError(null);
    const previous = current;
    setCurrent(next);

    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, postType: next }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setCurrent(previous);
        setError(json.error ?? "Tür güncellenemedi.");
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setCurrent(previous);
      setError("Bağlantı hatası.");
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <select
        value={current ?? ""}
        disabled={isPending}
        onChange={(event) => void changeType(event.target.value)}
        aria-label="Fikir türü"
        className="h-8 w-[150px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="" disabled>
          Tür seç
        </option>
        {POST_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isPending ? (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
