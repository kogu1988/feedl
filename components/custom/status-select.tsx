"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { statusLabels } from "@/lib/post-format";
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

// Durum etiketleri TEK kaynaktan gelir: lib/post-format.ts statusLabels
// (Sprint 9 "statusLabels dersi" — kopyalama yasak). Burada yalnızca
// sıralı liste tutulur; etiketler statusLabels'ten türetilir.
export const STATUS_ORDER = [
  "open",
  "under-review",
  "planned",
  "in-progress",
  "shipped",
  "closed",
] as const;

export const POST_STATUS_OPTIONS = STATUS_ORDER.map((value) => ({
  value,
  label: statusLabels[value] ?? value,
}));

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

// Admin için durum seçici: seçim PATCH /api/admin/posts'e gider,
// sayfa sunucu verisiyle tazelenir.
// Spread 63w (F4): Tek standart olan native <select> kabuğuna geçti
// (BoardSelect ile aynı görünüm) — menü tabanlı DropdownMenu yerine.
// Değişim yine dialog akışından geçer (opsiyonel açıklama, shipped bildirimi).
export function StatusSelect({
  postId,
  status,
}: {
  postId: string;
  status: string;
}) {
  // Optimistik gösterim: seçim anında yeni değere geçer, hata/refresh
  // sonrası sunucudan gelen `status` prop'una döner (Sprint 23 UX düzeltmesi:
  // "Stale local state kalmasın": value her zaman prop'tan türetilir).
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const router = useRouter();

  const current = optimistic ?? status;
  // Seçim açıldığında dialog onaylanana kadar yeni değeri göster; iptal
  // edilirse current'a döner (native select value'sundan beslenir).
  const display = pendingStatus ?? current;

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
      <select
        value={display}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value;
          if (next !== current) {
            setPendingStatus(next);
          }
        }}
        aria-label="Durum"
        className="h-8 w-[150px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {POST_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isPending ? (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
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
