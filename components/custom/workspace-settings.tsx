"use client";

import { useState } from "react";
import { Loader2Icon, LockIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 48a (madde 8) — workspace ayarları formu. Slug salt-okunur
// (subdomain kaynağı); custom domain, marka rengi ve logo düzenlenebilir.
// Sprint 63x — custom domain PRO özelliği: Free'de alan kilitlenir ve
// "Pro'ya Yükselt" CTA gösterilir (API de kontrol eder — çift güvenlik).

export interface WorkspaceSettingsView {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  widgetSubmissionMode: "anonymous" | "email" | "signup" | null;
  widgetAnonymousVoting: boolean | null;
}

export function WorkspaceSettings({
  initial,
  isPro = false,
}: {
  initial: WorkspaceSettingsView;
  isPro?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [customDomain, setCustomDomain] = useState(initial.customDomain ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#ff5c35");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [submissionMode, setSubmissionMode] = useState<
    "anonymous" | "email" | "signup"
  >(initial.widgetSubmissionMode ?? "signup");
  const [anonymousVoting, setAnonymousVoting] = useState(
    initial.widgetAnonymousVoting ?? false,
  );
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
          // Free'de custom domain kilitli — she şemaya gönderilmez (API de kontro
          // eder). Boş/default kalır.
          customDomain: customDomain.trim() || null,
          brandColor: brandColor.trim() ? brandColor.trim() : null,
          logoUrl: logoUrl.trim() || null,
          widgetSubmissionMode: submissionMode,
          widgetAnonymousVoting: anonymousVoting,
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
        <Label htmlFor="ws-domain" className="flex items-center gap-1.5">
          Custom domain
          {!isPro && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand">
              <LockIcon className="size-3" aria-hidden="true" />
              Pro
            </span>
          )}
        </Label>
        {isPro ? (
          <Input
            id="ws-domain"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="Örn: feedback.acme.com"
            maxLength={200}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="ws-domain"
              value={customDomain}
              readOnly
              placeholder="Örn: feedback.acme.com"
              disabled
              className="max-w-[320px] bg-muted"
            />
            <Button
              size="sm"
              render={
                <a href="/dashboard/billing">
                  Pro&apos;ya Yükselt
                </a>
              }
            >
              Pro&apos;ya Yükselt
            </Button>
          </div>
        )}
        {isPro ? (
          <p className="text-xs text-muted-foreground">
            Kendi alan adın (http:// veya https:// olmadan yalnızca host).
            Doğrulama bir sonraki adımda.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Custom domain yalnızca Pro planda. Pro&apos;ya geçerek kendi
            markalı alan adını kullan.
          </p>
        )}
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

      <div className="grid gap-1.5">
        <Label htmlFor="ws-submission-mode">Widget fikir gönderimi</Label>
        <p className="text-xs text-muted-foreground">
          Müşteri sitene gömülen widget&apos;ta ziyaretçilerin nasıl fikir
          göndereceğini seç.
        </p>
        <select
          id="ws-submission-mode"
          value={submissionMode}
          onChange={(e) =>
            setSubmissionMode(
              e.target.value as "anonymous" | "email" | "signup",
            )
          }
          className="h-9 w-full max-w-[320px] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="anonymous">Anonim — üye olmadan fikir + oy</option>
          <option value="email">E-posta — sadece mail adresinle</option>
          <option value="signup">Kayıt zorunlu — üye olarak</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Anonim: herkes üye olmadan fikir verebilir ve oy atabilir (IP başına).
          E-posta: sadece mail adresi istenir; kayıt yok. Kayıt: kurum içi
          toplama için uygundur.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymousVoting}
            onChange={(e) => setAnonymousVoting(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Anonim modda oy vermeye izin ver
        </label>
        <p className="text-xs text-muted-foreground">
          Kapalıysa anonim ziyaretçiler yalnız fikir gönderebilir; oy için
          kayıt/email gerekir.
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
