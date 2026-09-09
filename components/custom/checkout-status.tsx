"use client";

import { CheckCircle2Icon, CircleAlertIcon, Loader2 } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import type { CheckoutStatus } from "@/components/custom/use-checkout";

// Paddle checkout'u için tutarlı, profesyonel bir durum banner'ı.
// Kabuk TEK KAYNAK: hata/bilgi kutuları `Notice` bileşeninden geçer
// (DESIGN.md §5 "kopya hata kutusu yazılmaz"); yalnız ikon/içerik burada
// eklenir. loading/processing → spinner; success → yeşil onay; error →
// Notice(tone=error); closed → Notice(tone=info) soft. Success emerald
// ayrı bir "anons/pozitif" tonudur (error/info kutusu değil).
export function CheckoutStatusBanner({ status }: { status: CheckoutStatus }) {
  if (!status.message) return null;

  // Yükleme / doğrulama → nötr bilgi kutusu + spinner.
  if (status.tone === "loading" || status.tone === "processing") {
    return (
      <div role="status" aria-live="polite">
        <Notice tone="info">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
            <span>{status.message}</span>
          </span>
        </Notice>
      </div>
    );
  }

  if (status.tone === "success") {
    // Pozitif anons — emerald anlamsal "yayınlanan/başarılı" tonu (error/bilgi
    // kutusu değil), bu yüzden Notice yerine kendine ait yeşil durum kutusu.
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <span className="inline-flex items-center gap-2">
          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{status.message}</span>
        </span>
      </div>
    );
  }

  // Hata → Notice(tone=error) tek kaynak; kopya destructive kutu YOK.
  if (status.tone === "error") {
    return (
      <div role="alert">
        <Notice tone="error">
          <span className="inline-flex items-center gap-2">
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">{status.message}</span>
          </span>
        </Notice>
      </div>
    );
  }

  // closed → nötr bilgi (gözle görülür hata değil) → Notice(tone=info).
  return (
    <div role="status">
      <Notice tone="info">{status.message}</Notice>
    </div>
  );
}
