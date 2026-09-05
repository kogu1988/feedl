"use client";

import { useState } from "react";
import { Loader2Icon, ArrowRightIcon, CheckIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 63 (onboarding wizard) — yeni müşteri için 2 adımlı akış:
// 1) Workspace oluştur (name → POST /api/onboarding, aktif çerez set edilir)
// 2) Sonraki adımlar: board, entegrasyon, ekip daveti, widget + "Dashboard'a git".
export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

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
        body: JSON.stringify({ name: name.trim() }),
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
