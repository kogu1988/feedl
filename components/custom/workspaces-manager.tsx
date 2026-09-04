"use client";

import { useState } from "react";
import { Loader2Icon, PlusIcon, GlobeIcon } from "lucide-react";

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

// Sprint 48g (madde 8) — workspace yönetimi. Her workspace subdomain'inde
// izole; yeni workspace oluşturma (varsayılan board + owner otomatik).

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  createdAt: Date;
  boardCount: number;
}

export function WorkspacesManager({ initial }: { initial: WorkspaceView[] }) {
  const [items, setItems] = useState<WorkspaceView[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/workspaces", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setItems(json.data);
  }

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError("Workspace adı gerekli.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Oluşturulamadı. Lütfen tekrar deneyin.");
        return;
      }
      setOpen(false);
      setName("");
      setSlug("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Oluşturulamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.length} workspace</p>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon aria-hidden="true" />
          Yeni Workspace
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {items.map((ws) => (
          <li key={ws.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{ws.name}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {ws.slug}.feedl.app
                </code>
                <span className="text-xs text-muted-foreground">
                  {ws.boardCount} board
                </span>
              </div>
              {ws.customDomain ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <GlobeIcon className="size-3" aria-hidden="true" />
                  {ws.customDomain}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Workspace</DialogTitle>
            <DialogDescription>
              İzole bir çalışma alanı — kendi subdomain&apos;inde yayınlanır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace adı</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Acme"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-slug">Subdomain (slug)</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="ws-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme"
                  maxLength={63}
                />
                <span className="text-sm text-muted-foreground">.feedl.app</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Küçük harf, rakam ve tire. Boş bırakılırsa adresten otomatik üretilir.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
