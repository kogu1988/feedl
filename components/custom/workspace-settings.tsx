"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 48a (madde 8) — workspace ayarları formu. Slug salt-okunur
// (subdomain kaynağı); custom domain, marka rengi ve logo düzenlenebilir.

export interface WorkspaceSettingsView {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}

export function WorkspaceSettings({
  initial,
}: {
  initial: WorkspaceSettingsView;
}) {
  const [name, setName] = useState(initial.name);
  const [customDomain, setCustomDomain] = useState(initial.customDomain ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#ff5c35");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Workspace adı gerekli.");
      return;
    }
    if (brandColor && !/^#?[0-9a-fA-F]{6}$/.test(brandColor.trim())) {
      setError("Marka rengi geçerli bir hex renk olmalı. Örn: #ff5c35");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          customDomain: customDomain.trim() || null,
          brandColor: brandColor.trim() ? brandColor.trim() : null,
          logoUrl: logoUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4 rounded-lg border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ws-name">Workspace adı</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="Örn: feedl"
        />
        <p className="text-xs text-muted-foreground">
          Portalda ve e-postalarda görünen isim.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-slug">Subdomain (salt okunur)</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Input
            id="ws-slug"
            value={initial.slug}
            readOnly
            className="max-w-[180px] bg-muted"
          />
          <span>.feedl.app</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Workspace bazlı portal adresi — başka bir uygulama için örn.
          acme.feedl.app. Değiştirilemez.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-domain">Custom domain (opsiyonel)</Label>
        <Input
          id="ws-domain"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="Örn: feedback.acme.com"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">
          Kendi alan adın (http:// veya https:// olmadan yalnızca host).
          Doğrulama bir sonraki adımda.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-color">Marka rengi (opsiyonel)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ws-color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="Örn: #ff5c35"
            maxLength={20}
            className="max-w-[180px]"
          />
          <span
            className="inline-block size-6 rounded-md border"
            style={{ backgroundColor: brandColor }}
            aria-hidden="true"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          6 haneli hex renk kodu — # ile veya # olmadan yazabilirsin (örn.
          #ff5c35). Boş bırakılırsa varsayılan mercan kullanılır.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-logo">Logo URL (opsiyonel)</Label>
        <Input
          id="ws-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="Örn: https://cdn.example.com/logo.png"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Portal başlığında görüntülenecek marka logosu (tam URL).
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          )}
          Kaydet
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Kaydedildi.
          </span>
        )}
      </div>

      {error && (
        <Notice>
          {error}
        </Notice>
      )}
    </div>
  );
}
