"use client";

import { useState } from "react";
import { Loader2Icon, ArrowRightIcon, CheckIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { textOn } from "@/lib/color";

// Sprint 63 (onboarding wizard) — yeni müşteri için 2 adımlı akış:
// 1) Workspace oluştur (name → POST /api/onboarding, aktif çerez set edilir)
//    + CANLI alt alan adı (slug.feedl.app) ve marka rengi önizlemesi.
// 2) Sonraki adımlar: board, entegrasyon, ekip daveti, widget + "Dashboard'a git".

// Marka rengi seçenekleri (Canny/Intercom tarzı hazır palet + serbest renk).
const BRAND_COLORS = ["#ff5c35", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#e11d48", "#64748b"];

function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState<string>("#ff5c35");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  // Canlı önizleme: ad yazıldıkça subdomain ve portal linki güncellenir.
  const previewSlug = slugify(name);
  const portalUrl = previewSlug ? `${previewSlug}.feedl.app` : null;

  async function createWorkspace() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Workspace adı en az 2 karakter olmalı.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: previewSlug || undefined,
          brandColor: brandColor.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Workspace oluşturulamadı. Lütfen tekrar deneyin.");
        return;
      }
      setSlug(json.data?.slug ?? null);
      setStep(2);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Workspace oluşturulamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }

  const nextSteps = [
    { label: "İlk feedback panosunu düzenle", href: "/dashboard/boards" },
    { label: "Bir entegrasyon bağla (Linear / Jira / Slack)", href: "/dashboard/settings" },
    { label: "Ekibini davet et", href: "/dashboard/members" },
    { label: "Widget'ı kur", href: "/dashboard/widget" },
  ];

  return (
    <div className="rounded-lg border p-5">
      {step === 1 ? (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ws-name">Çalışma alanı adı</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Acme Geri Bildirim"
              maxLength={120}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Bu ad portalının üstünde görünür. Subdomain adı otomatik üretilir.
            </p>
          </div>

          {/* Alt alan adı + marka önizlemesi (canlı) */}
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Portal önizlemesi</span>
              {portalUrl ? (
                <span className="font-mono text-xs text-muted-foreground">{portalUrl}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Ad girince</span>
              )}
            </div>

            {/* Mini portall önizleme: marka rengiyle üst bar + isim */}
            <div
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
              style={{ backgroundColor: brandColor, color: textOn(brandColor) }}
            >
              <span className="font-semibold">{name.trim() || "Yeni çalışma alanı"}</span>
              <span className="text-xs opacity-80">feedl</span>
            </div>

            {/* Marka rengi seçici */}
            <div className="flex flex-wrap items-center gap-2">
              {BRAND_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Marka rengi ${color}`}
                  aria-pressed={brandColor === color}
                  onClick={() => setBrandColor(color)}
                  className={`size-6 rounded-full border-2 ${brandColor === color ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Özel:
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border bg-transparent"
                  aria-label="Marka rengi seç"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={createWorkspace} disabled={busy}>
              {busy ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRightIcon aria-hidden="true" />
              )}
              Çalışma alanını oluştur
            </Button>
          </div>

          {error && (
            <Notice>
              {error}
            </Notice>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckIcon aria-hidden="true" />
            Çalışma alanı hazır{slug ? ` (${slug})` : ""}. Aşağıdakilerle devam edebilirsin.
          </div>

          <ul className="grid gap-2">
            {nextSteps.map((step) => (
              <li key={step.href}>
                <a
                  href={step.href}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {step.label}
                </a>
              </li>
            ))}
          </ul>

          <div>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
            >
              Admin Paneli&apos;ne git
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
