"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const POST_STATUS_OPTIONS = [
  { value: "open", label: "Açık" },
  { value: "under-review", label: "İncelemede" },
  { value: "planned", label: "Planlandı" },
  { value: "in-progress", label: "Geliştiriliyor" },
  { value: "shipped", label: "Yayınlandı" },
  { value: "closed", label: "Kapatıldı" },
] as const;

export function statusLabel(status: string): string {
  return (
    POST_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

// Admin için durum seçici: seçim PATCH /api/admin/posts'e gider,
// sayfa sunucu verisiyle tazelenir.
export function StatusSelect({
  postId,
  status,
}: {
  postId: string;
  status: string;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const changeStatus = async (next: string) => {
    setError(null);
    const previous = current;
    setCurrent(next);

    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status: next }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setCurrent(previous);
        setError(json.error ?? "Durum güncellenemedi.");
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
              {statusLabel(current)}
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(value) => void changeStatus(value)}
          >
            {POST_STATUS_OPTIONS.map((option) => (
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
