"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

import { typeLabels } from "@/lib/post-format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sprint 21: fikir türü seçenekleri — etiketler TEK kaynaktan (lib/post-format
// typeLabels). Sıralı liste tutulur, etiketler typeLabels'ten türetilir.
export const TYPE_ORDER = ["feature", "bug", "usability"] as const;

export const POST_TYPE_OPTIONS = TYPE_ORDER.map((value) => ({
  value,
  label: typeLabels[value] ?? value,
}));

// Admin için tür seçici: seçim PATCH /api/admin/posts'e gider
// (postType alanı), sayfa sunucu verisiyle tazelenir.
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              {current
                ? (POST_TYPE_OPTIONS.find((o) => o.value === current)?.label ??
                  current)
                : "Tür seç"}
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={current ?? ""}
            onValueChange={(value) => void changeType(value)}
          >
            {POST_TYPE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
                {option.value === current ? (
                  <CheckIcon className="ml-auto size-4" aria-hidden="true" />
                ) : null}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
