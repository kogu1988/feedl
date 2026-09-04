"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MegaphoneIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface ChangelogEntryItem {
  id: string;
  title: string;
  body: string;
  label: string | null;
  publishedAtLabel: string;
}

export interface ShippedPostOption {
  id: string;
  title: string;
}

const LABEL_OPTIONS = [
  { value: "", label: "Etiket yok" },
  { value: "yeni", label: "Yeni" },
  { value: "iyileştirme", label: "İyileştirme" },
  { value: "düzeltme", label: "Düzeltme" },
] as const;

// Sprint 25: admin changelog paneli — duyuru yaz, fikirlere bağla,
// mevcut duyuruları sil. Dashboard'da sunucudan entry + shipped fikir
// listesi gelir; işlem sonrası router.refresh() tazeler.
export function ChangelogAdmin({
  entries,
  shippedPosts,
}: {
  entries: ChangelogEntryItem[];
  shippedPosts: ShippedPostOption[];
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const togglePost = (id: string, checked: boolean) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const submit = async () => {
    setError(null);
    setSuccess(false);
    if (title.trim().length < 3 || body.trim().length < 3) {
      setError("Başlık ve gövde en az 3 karakter olmalı.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
          ...(label ? { label } : {}),
          ...(selectedPosts.size > 0 ? { postIds: [...selectedPosts] } : {}),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Duyuru kaydedilemedi.");
        return;
      }
      setTitle("");
      setBody("");
      setImageUrl("");
      setLabel("");
      setSelectedPosts(new Set());
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Bu duyuru silinsin mi?")) {
      return;
    }
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/changelog?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Duyuru silinemedi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MegaphoneIcon className="size-4" aria-hidden="true" />
          Yeni duyuru
        </h3>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Başlık (örn. Koyu mod yayında!)"
          maxLength={120}
          aria-label="Duyuru başlığı"
        />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Duyuru metni — neler değişti, nasıl kullanılır?"
          rows={5}
          maxLength={5000}
          aria-label="Duyuru metni"
        />
        <p className="text-xs text-muted-foreground">Markdown destekler.</p>
        <Input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="Görsel URL'si (opsiyonel)"
          maxLength={2048}
          type="url"
          aria-label="Duyuru görseli URL'si"
 />
        <div className="flex items-center gap-2">
          <Label htmlFor="changelog-label" className="text-xs text-muted-foreground">
            Etiket
          </Label>
          <select
            id="changelog-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {LABEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {shippedPosts.length > 0 ? (
          <div className="grid gap-1.5 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              İlgili fikirler (opsiyonel — shipped fikirler):
            </p>
            {shippedPosts.map((post) => (
              <div key={post.id} className="flex items-center gap-2">
                <Checkbox
                  id={`cp-${post.id}`}
                  checked={selectedPosts.has(post.id)}
                  onCheckedChange={(checked) =>
                    togglePost(post.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`cp-${post.id}`}
                  className="max-w-[280px] truncate text-xs font-normal"
                >
                  {post.title}
                </Label>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Duyuru yayınlandı — /portal/changelog sayfasında görünüyor.
          </p>
        ) : null}
        <div>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Duyuruyu yayınla
          </Button>
        </div>
      </div>

      <div className="grid content-start gap-2">
        <h3 className="text-sm font-semibold">Mevcut duyurular</h3>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Henüz duyuru yok.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 rounded-md border p-3"
            >
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{entry.title}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.publishedAtLabel}
                  {entry.label ? ` · ${entry.label}` : ""}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void remove(entry.id)}
                disabled={deletingId === entry.id}
                aria-label={`${entry.title} duyurusunu sil`}
              >
                {deletingId === entry.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Trash2Icon className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
