"use client";

import { CheckCircle2Icon, CircleAlertIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { CheckoutStatus } from "@/components/custom/use-checkout";

// Paddle checkout'u için tutarlı, profesyonel bir durum banner'ı.
// loading/processing → spinner + nötr metin; success → yeşil onay;
// error → kırmızı; closed → sessiz/soft (alarm verici değil).
export function CheckoutStatusBanner({ status }: { status: CheckoutStatus }) {
  if (!status.message) return null;

  if (status.tone === "loading" || status.tone === "processing") {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span>{status.message}</span>
      </div>
    );
  }

  if (status.tone === "success") {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{status.message}</span>
      </div>
    );
  }

  if (status.tone === "error") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive",
        )}
        role="alert"
      >
        <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{status.message}</span>
      </div>
    );
  }

  // closed → soft, nötr bilgi (hata gibi görünmez).
  return (
    <div
      className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      role="status"
    >
      {status.message}
    </div>
  );
}
