"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Sprint 59 (madde — onboarding): Dashboard'daki "Başlarken" checklist'i.
// Gerçek workspace verisinden türetilir; adım tamamlandıkça kutu otomatik
// işaretlenir. Kullanıcı "Şimdilik gizle" derse PATCH /api/admin/workspace ile
// onboardingDismissedAt set edilir (kalıcı gizle). Tüm kilit adımlar bittiğinde
// de gizlenir.

export interface OnboardingChecklistView {
  boardCount: number;
  postCount: number;
  memberCount: number;
  integrationCount: number;
  widgetOriginCount: number;
  onboardingDismissedAt: string | null;
  portalUrl: string;
}

interface Step {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export function OnboardingChecklist({
  state,
}: {
  state: OnboardingChecklistView;
}) {
  const [dismissed, setDismissed] = useState(false);

  const steps: Step[] = [
    {
      key: "board",
      label: "İlk feedback panosunu (board) oluştur",
      href: "/dashboard/boards",
      done: state.boardCount > 0,
    },
    {
      key: "feedback",
      label: "İlk fikri al / portalı yayınla",
      href: state.portalUrl,
      done: state.postCount > 0,
    },
    {
      key: "team",
      label: "Ekibini davet et",
      href: "/dashboard/members",
      done: state.memberCount > 1,
    },
    {
      key: "integration",
      label: "Bir entegrasyon ya da widget bağla",
      href: "/dashboard/settings",
      done: state.integrationCount > 0 || state.widgetOriginCount > 0,
    },
  ];

  // Gizleme durumu: kullanıcı gizlemişse veya kilit adımların hepsi bittiyse.
  const shouldHide = dismissed || Boolean(state.onboardingDismissedAt) || steps.every((s) => s.done);
  if (shouldHide) return null;

  async function dismiss() {
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissOnboarding: true }),
      });
      const json = await res.json();
      if (json.success) setDismissed(true);
    } catch {
      // Sessiz — hata olursa gizleme yerel işaretle, sayfa yenilenince geri gelir.
      setDismissed(true);
    }
  }

  return (
    <div className="mt-8 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <span aria-hidden="true" className="text-muted-foreground">
              🚀
            </span>
            Feedl&apos;i kurmaya başla
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu adımları tamamladığında Feedl senin için çalışmaya başlar. İlerleme
            otomatik takip edilir.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Şimdilik gizle">
          <XIcon aria-hidden="true" />
          Gizle
        </Button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.key}>
            <a
              href={step.href}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                  step.done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-muted-foreground/40 text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {step.done ? <CheckIcon className="size-3.5" /> : null}
              </span>
              <span className={step.done ? "text-muted-foreground line-through" : ""}>
                {step.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
