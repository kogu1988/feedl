"use client";

import { useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Sprint 63l — "Yenile" butonu: POST /api/corpus-insights (Inngest arka planda)
// sonra sayfayı yeniler. 63m: kaynak zorlamayı önlemek — `status === "pending"`
// iken buton DEVRE DIŞI + spinner "AI içgörüleri hazırlanıyor."; ayrıca tıklama
// sonrası busy (kısa cooldown) ile peşpeşe tıklama engellenir.
export function InsightsRefreshButton({ status }: { status: "idle" | "pending" | "done" | "error" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/corpus-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Analiz başlatılamadı.");
        setBusy(false);
        return;
      }
      // Başarılı: sayfayı yenile (server pending/done durumunu gösterir).
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      setError("Bağlantı hatası.");
      setBusy(false);
    }
  }

  const pending = status === "pending" || busy;

  return (
    <div className="flex w-full items-end justify-end flex-col gap-1">
      <Button
        variant={pending ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={() => void refresh()}
      >
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            AI içgörüleri hazırlanıyor…
          </>
        ) : (
          <>
            <RefreshCwIcon className="size-4" />
            Yenile
          </>
        )}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
