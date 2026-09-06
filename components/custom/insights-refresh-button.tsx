"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Sprint 63l — "Yenile" butonu: /api/corpus-insights'a POST atar (Inngest
// arka planda üretir), sonra sayfayı yeniler. Kullanıcının senkron LLM
// çağrısıyla karşılaşmasını engeller.
export function InsightsRefreshButton() {
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
        return;
      }
      window.location.reload();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>
        {busy ? <RefreshCwIcon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
        Yenile
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
