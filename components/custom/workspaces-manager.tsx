"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, PlusIcon, GlobeIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
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
//
// 2026-09-12 (kullanıcı): bu liste aynı zamanda SEÇİCİDİR. Daha önce "mevcut
// workspace" yalnız host'tan çözülüyordu ve kullanıcı hangi workspace üzerinde
// çalıştığını (dolayısıyla hangisini düzenlediğini/sildiğini) SEÇEMİYORDU.
// Artık "Geç" ile aktif workspace değişir; aynı sayfadaki ayarlar ve veri
// işlemleri o workspace'i hedefler.

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  createdAt: Date;
  boardCount: number;
}

export function WorkspacesManager({
  initial,
  activeWorkspaceId,
}: {
  initial: WorkspaceView[];
  // Aktif (üzerinde çalışılan) workspace — listede işaretlenir.
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<WorkspaceView[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Aktif workspace'i değiştir. Sunucu, kullanıcının HEDEF workspace'te üye
  // olduğunu doğrular (çerez yetki bariyeri değildir) ve `feedl_active_ws`
  // çerezini set eder; ardından sayfa yeni workspace bağlamıyla tazelenir.
  async function activate(workspaceId: string) {
    setError(null);
    setSwitchingId(workspaceId);
    try {
      const res = await fetch("/api/admin/workspaces/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Workspace değiştirilemedi.");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace değiştirilemedi.");
    } finally {
      setSwitchingId(null);
    }
  }

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
      // Yeni oluşturulan workspace'e GEÇ: kullanıcı onu yönetmek ister ve aksi
      // halde "oluşturdum ama ayarlar hâlâ eskisini gösteriyor" kafa karışıklığı
      // doğar. Onboarding de aktif çerezi aynı şekilde set eder.
      if (json.data?.id) await activate(json.data.id);
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
        <p className="text-xs text-muted-foreground">
          {`${items.length} workspace · "Geç" ile aktif workspace'i seç`}
        </p>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon aria-hidden="true" />
          Yeni Workspace
        </Button>
      </div>

      {error && (
        <Notice>
          {error}
        </Notice>
      )}

      <ul className="divide-y rounded-lg border">
        {items.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          return (
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
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      <CheckIcon className="size-3" aria-hidden="true" />
                      Aktif
                    </span>
                  ) : null}
                </div>
                {ws.customDomain ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <GlobeIcon className="size-3" aria-hidden="true" />
                    {ws.customDomain}
                  </p>
                ) : null}
              </div>
              {!isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void activate(ws.id)}
                  disabled={switchingId !== null}
                >
                  {switchingId === ws.id ? (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Geç
                </Button>
              ) : null}
            </li>
          );
        })}
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
              <Label htmlFor="ws-create-name">Workspace adı</Label>
              <Input
                id="ws-create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Acme"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-create-slug">Subdomain (slug)</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="ws-create-slug"
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
