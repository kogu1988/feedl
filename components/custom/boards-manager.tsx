"use client";

import { useState } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Sprint 48b (madde 8) — board yönetim bileşeni. Varsayılan "genel" board
// silinemez ve gizli yapılamaz (API de engeller).

export interface BoardView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: "public" | "private";
  sortOrder: number;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function BoardsManager({ initial }: { initial: BoardView[] }) {
  const [boards, setBoards] = useState<BoardView[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardView | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDefault = (b: BoardView) => b.slug === "genel";

  async function refresh() {
    const res = await fetch("/api/admin/boards", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setBoards(json.data);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setVisibility("public");
    setError(null);
    setOpen(true);
  }

  function openEdit(b: BoardView) {
    setEditing(b);
    setName(b.name);
    setSlug(b.slug);
    setDescription(b.description ?? "");
    setVisibility(b.visibility);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Board adı gerekli.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      ...(editing ? {} : { slug: slug.trim().toLowerCase() }),
      description: description.trim() || null,
      visibility,
    };
    try {
      const res = await fetch(
        editing ? `/api/admin/boards?id=${editing.id}` : "/api/admin/boards",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: BoardView) {
    if (
      !window.confirm(
        `"${b.name}" board'u silinecek. Bu board'daki fikirler bağsız kalır. Emin misin?`,
      )
    ) {
      return;
    }
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/boards?id=${b.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Board silinemedi.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{boards.length} board</p>
        <Button onClick={openCreate}>
          <PlusIcon aria-hidden="true" />
          Board Ekle
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {boards.map((b) => (
          <li key={b.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{b.name}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {b.slug}
                </code>
                <span
                  className={
                    b.visibility === "private"
                      ? "rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      : "rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                  }
                >
                  {b.visibility === "private" ? "Gizli" : "Herkese açık"}
                </span>
              </div>
              {b.description ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {b.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Düzenle"
                onClick={() => openEdit(b)}
              >
                <PencilIcon aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sil"
                disabled={isDefault(b) || busyId === b.id}
                onClick={() => remove(b)}
              >
                {busyId === b.id ? (
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                ) : (
                  <TrashIcon aria-hidden="true" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Board'u Düzenle" : "Board Ekle"}
            </DialogTitle>
            <DialogDescription>
              Feedback koleksiyonu — kendi portalına sahip olur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="board-name">Board adı</Label>
              <Input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Özellik İstekleri"
                maxLength={120}
              />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="board-slug">Slug (URL)</Label>
                <Input
                  id="board-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="Örn: ozellik-istekleri"
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground">
                  Portal adresi: feedl.app/portal/[slug] — küçük harf, tire.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="board-desc">Açıklama (opsiyonel)</Label>
              <Textarea
                id="board-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu board'da ne toplanır?"
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="board-vis">Görünürlük</Label>
              <select
                id="board-vis"
                className={selectClassName}
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "private")
                }
              >
                <option value="public">Herkese açık</option>
                <option value="private">Gizli (yalnızca yönetici)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
