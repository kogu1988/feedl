"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, KeyRoundIcon, Loader2Icon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  lastUsedLabel: string | null;
  createdAtLabel: string;
}

// Sprint 34: API anahtarı yönetimi. Tam anahtar yalnızca oluşturma anında
// sunucudan döner ve ekranda bir kez gösterilir (kopyalanmadıysa kurtarılamaz).
export function ApiKeysManager({ items }: { items: ApiKeyItem[] }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Anahtar adı gerekli.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { key: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? "Anahtar oluşturulamadı.");
        return;
      }
      setName("");
      setCreatedKey(json.data.key);
      setCopied(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    setRevokingId(id);
    try {
      const res = await fetch(`/api/admin/api-keys?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Anahtar iptal edilemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setRevokingId(null);
    }
  };

  const copy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Anahtar adı (örn. Mobil uygulama)"
          className="max-w-xs"
          maxLength={100}
        />
        <Button onClick={create} disabled={creating || isPending}>
          {creating ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRoundIcon className="size-4" aria-hidden="true" />
          )}
          Anahtar Üret
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {createdKey ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            Anahtarını şimdi kopyala — tekrar gösterilmeyecek:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">
              {createdKey}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              <CopyIcon className="size-4" aria-hidden="true" />
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Henüz API anahtarı yok. /api/v1 uçlarını kullanmak için bir anahtar
          üret.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.name}{" "}
                  <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                    {item.prefix}…
                  </code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.revoked
                    ? "İptal edildi"
                    : item.lastUsedLabel
                      ? `Son kullanım: ${item.lastUsedLabel}`
                      : "Hiç kullanılmadı"}{" "}
                  · Oluşturma: {item.createdAtLabel}
                </p>
              </div>
              {!item.revoked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(item.id)}
                  disabled={revokingId === item.id || isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {revokingId === item.id ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <TrashIcon className="size-4" aria-hidden="true" />
                  )}
                  İptal Et
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
