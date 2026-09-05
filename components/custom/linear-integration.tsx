"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 58 (madde 2) — workspace ayarlarındaki Linear entegrasyon kartı.
// Workspace admin'i Linear API key girer → `/api/integrations/linear/connect`
// Linear webhook'u otomatik oluşturur (Linear UI'da manuel kural yok).
export function LinearIntegration() {
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<{
    viewerName: string;
    viewerEmail: string;
  } | null>(null);

  async function connect() {
    setError(null);
    setConnected(null);
    if (!apiKey.trim()) {
      setError("Linear API key gerekli.");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/linear/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Bağlanılamadı. Lütfen tekrar deneyin.");
        return;
      }
      setConnected({
        viewerName: json.data?.viewer?.name ?? "Linear",
        viewerEmail: json.data?.viewer?.email ?? "",
      });
      setApiKey("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bağlanılamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Entegrasyonlar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uygulamanı Linear&apos;a bağla: yeni Issue, Comment ve Customer Need
          olayları otomatik olarak feedback panosuna düşer.
        </p>
      </div>

      {!connected ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="linear-api-key">Linear API key</Label>
            <Input
              id="linear-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="lin_api_…"
              autoComplete="off"
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              Linear&apos;da Settings → Account → Security &amp; Access →
              API keys ekranından oluştur (admin olmalı). Anahtar yalnızca
              sunucuda kullanılır, saklanmaz.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={connect} disabled={connecting}>
              {connecting && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Linear&apos;ı bağla
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          <span aria-hidden="true">✓</span>
          <span>
            Linear bağlı ({connected.viewerName}
            {connected.viewerEmail ? ` · ${connected.viewerEmail}` : ""}).
            Webhook otomatik oluşturuldu.
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
