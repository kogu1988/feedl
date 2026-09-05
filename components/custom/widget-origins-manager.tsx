"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlobeIcon, Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import { Input } from "@/components/ui/input";

export interface WidgetOriginItem {
  id: string;
  origin: string;
  label: string | null;
  createdAtLabel: string;
}

// Sprint 38: widget origin allowlist yönetimi. Bu listedeki origin'ler
// (feedl'in kendi domainine ek olarak) widget isteklerinde kabul edilir.
export function WidgetOriginsManager({ items }: { items: WidgetOriginItem[] }) {
  const [origin, setOrigin] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const add = async () => {
    if (!origin.trim()) {
      setError("Origin gerekli.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/widget-origins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: origin.trim(), label: label.trim() || undefined }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Origin eklenemedi.");
        return;
      }
      setOrigin("");
      setLabel("");
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/widget-origins?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Origin silinemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Widget yalnızca feedl&apos;in kendi alan adından ve aşağıdaki izinli
        origin&apos;lerden çalışır. Müşteri sitenizi ekleyin — yol içermeyen
        tam adres yeterli (örn. <code className="rounded bg-muted px-1.5 py-0.5 text-xs">https://siteniz.com</code>).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="https://siteniz.com"
          className="max-w-xs"
          maxLength={200}
          type="url"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiket (opsiyonel)"
          className="max-w-44"
          maxLength={120}
        />
        <Button onClick={add} disabled={adding || isPending}>
          {adding ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PlusIcon className="size-4" aria-hidden="true" />
          )}
          Ekle
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState>
          Henüz eklenmiş origin yok. Widget&apos;ı gömeceğiniz sitenin origin&apos;ini
          ekleyin; aksi halde istekler reddedilir.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <code className="truncate">{item.origin}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.label ? `${item.label} · ` : ""}Eklenme: {item.createdAtLabel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(item.id)}
                disabled={deletingId === item.id || isPending}
                className="text-destructive hover:text-destructive"
              >
                {deletingId === item.id ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <TrashIcon className="size-4" aria-hidden="true" />
                )}
                Sil
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
