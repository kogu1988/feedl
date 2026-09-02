"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  // Optimistik gösterim: seçim anında yeni değere geçer, hata/refresh
  // sonrası sunucudan gelen `status` prop'una döner (Sprint 23 UX düzeltmesi:
  // dropdown'daki işaret her zaman prop'tan türetilir, stale local state
  // kalmasın diye RadioGroup value değişiminde remount edilir).
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const router = useRouter();

  const current = optimistic ?? status;

  // Menüden durum seçilince doğrudan PATCH atmak yerine dialog açılır:
  // opsiyonel açıklama girilebilir (Sprint 25a) — shipped bildiriminde
  // "Ekibin notu" olarak gösterilir. Dialog"u boş geçmek tek tıkla
  // değiştirmeye yakın hızda kalır.
  const changeStatus = async (next: string, noteText?: string) => {
    setError(null);
    setOptimistic(next);

    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          status: next,
          ...(noteText && noteText.trim()
            ? { note: noteText.trim() }
            : {}),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setOptimistic(null);
        setError(json.error ?? "Durum güncellenemedi.");
        return;
      }

      setPendingStatus(null);
      setNote("");
      // Optimistik değeri bırak, sunucudan gelen prop'a dön (aksi halde
      // optimistic !== null kalır ve sonraki dialog butonu kilitli kalır).
      setOptimistic(null);
      startTransition(() => router.refresh());
    } catch {
      setOptimistic(null);
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
            key={current}
            value={current}
            onValueChange={(value) => {
              if (value !== current) {
                setPendingStatus(value);
              }
            }}
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

      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Durum: {statusLabel(current)} → {statusLabel(pendingStatus ?? "")}
            </DialogTitle>
            <DialogDescription>
              Açıklama eklemek isterseniz yazın — shipped bildiriminde
              &quot;Ekibin notu&quot; olarak gösterilir. Boş bırakabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Değişim açıklaması (opsiyonel, en fazla 500 karakter)"
            aria-label="Değişim açıklaması"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingStatus(null);
                setNote("");
              }}
            >
              İptal
            </Button>
            <Button
              onClick={() => void changeStatus(pendingStatus ?? current, note)}
              disabled={isPending || optimistic !== null}
            >
              {isPending || optimistic !== null ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Durumu güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
