"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  BellIcon,
  CopyIcon,
  Loader2Icon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const WEBHOOK_EVENT_OPTIONS = [
  { value: "post.created", label: "Fikir oluşturuldu" },
  { value: "post.status_changed", label: "Fikir durumu değişti" },
  { value: "comment.created", label: "Yorum yazıldı" },
  { value: "comment.deleted", label: "Yorum silindi" },
  { value: "vote.created", label: "Oy verildi" },
  { value: "vote.deleted", label: "Oy geri alındı" },
  { value: "changelog.published", label: "Duyuru yayınlandı" },
] as const;

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAtLabel: string;
}

// Sprint 34: webhook endpoint yönetimi. Secret sunucuda üretilir ve yalnızca
// oluşturma anında bir kez gösterilir; teslimat Inngest'ten imzalı yapılır.
export function WebhooksManager({ items }: { items: WebhookItem[] }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["post.created"]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Sprint 43: dead-letter — başarısız webhook teslimatları.
  const [deadLetters, setDeadLetters] = useState<
    {
      id: string;
      event: string;
      attempts: number;
      lastError: string | null;
      createdAtLabel: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const loadDeadLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/admin/webhooks/deliveries?status=failed",
        { cache: "no-store" },
      );
      const json = await res.json();
      if (json.success) {
        setDeadLetters(
          (json.data as {
            id: string;
            event: string;
            attempts: number;
            lastError: string | null;
            createdAt: string;
          }[]).map((d) => ({
            id: d.id,
            event: d.event,
            attempts: d.attempts,
            lastError: d.lastError,
            createdAtLabel: new Date(d.createdAt).toLocaleString("tr-TR"),
          })),
        );
      }
    } catch {
      // yoksay
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeadLetters();
  }, []);

  const replay = async (id: string) => {
    setReplayingId(id);
    try {
      const res = await fetch(
        `/api/admin/webhooks/deliveries/${id}/replay`,
        { method: "POST" },
      );
      const json = await res.json();
      if (json.success) {
        await loadDeadLetters();
      }
    } finally {
      setReplayingId(null);
    }
  };

  const toggleEvent = (value: string, checked: boolean) => {
    setEvents((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    );
  };

  const create = async () => {
    const trimmed = url.trim();
    if (!trimmed || events.length === 0) {
      setError("Geçerli bir URL ve en az bir olay seçilmeli.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, events }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { secret: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? "Webhook kaydedilemedi.");
        return;
      }
      setUrl("");
      setEvents(["post.created"]);
      setCreatedSecret(json.data.secret);
      setCopied(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/webhooks?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Webhook silinemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  };

  const copy = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://siteniz.com/webhooks/feedl"
          className="max-w-md"
          type="url"
        />
        <div className="flex flex-wrap gap-4">
          {WEBHOOK_EVENT_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`wh-${option.value}`}
                checked={events.includes(option.value)}
                onCheckedChange={(checked) =>
                  toggleEvent(option.value, checked === true)
                }
              />
              <Label htmlFor={`wh-${option.value}`} className="text-sm">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
        <Button onClick={create} disabled={creating || isPending}>
          {creating ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <BellIcon className="size-4" aria-hidden="true" />
          )}
          Webhook Ekle
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {createdSecret ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            İmza secret&apos;ını şimdi kopyala — tekrar gösterilmeyecek:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">
              {createdSecret}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              <CopyIcon className="size-4" aria-hidden="true" />
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState>
          Kayıtlı webhook yok. Seçtiğin olaylar gerçekleşince URL&apos;ne imzalı
          POST gönderilir.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div className="min-w-0">
                <p className="max-w-sm truncate text-sm font-medium">
                  {item.url}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.events.join(", ")} · {item.createdAtLabel}
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

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Son başarısız teslimatlar
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDeadLetters}
            disabled={loading}
          >
            <RefreshCwIcon
              className={loading ? "size-3.5 animate-spin" : "size-3.5"}
              aria-hidden="true"
            />
            Yenile
          </Button>
        </div>
        {deadLetters.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
            Başarısız teslimat yok.
          </p>
        ) : (
          <ul className="space-y-2">
            {deadLetters.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <AlertTriangleIcon
                      className="size-3.5 text-destructive"
                      aria-hidden="true"
                    />
                    {d.event}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.createdAtLabel} · {d.attempts} deneme
                  </p>
                  {d.lastError ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {d.lastError}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => replay(d.id)}
                  disabled={replayingId === d.id}
                >
                  {replayingId === d.id ? (
                    <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                  )}
                  Yeniden Dene
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
