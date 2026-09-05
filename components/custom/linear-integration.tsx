"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 58 (madde 2) — workspace ayarlarındaki Linear entegrasyon kartı.
// Bağlanmamışsa: API key gir → POST /api/integrations/linear/connect (Linear
// webhook'u otomatik oluşturur). Bağlıysa: durum gösterir + "Bağlantıyı kes"
// (DELETE) — Linear webhook'u uzaktan siler, kaydı kaldırır.

interface LinearStatus {
  connected: boolean;
  record?: {
    status: string;
    resourceTypes: string[];
    linearTeamId: string | null;
    createdAt: string;
  };
}

export function LinearIntegration() {
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<LinearStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/integrations/linear/connect", { method: "GET" });
      const json = await res.json();
      if (json.success) {
        setStatus(json.data as LinearStatus);
      }
    } catch {
      // sessiz — durum yüklenemezse formu göster.
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function connect() {
    setError(null);
    setStatus(null);
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
      setApiKey("");
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bağlanılamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setError(null);
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/linear/connect", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Bağlantı kesilemedi.");
        return;
      }
      setStatus(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bağlantı kesilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const isConnected = Boolean(status?.connected);

  return (
    <div className="mt-4 grid gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Entegrasyonlar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uygulamanı Linear&apos;a bağla: yeni Issue, Comment ve Customer Need
          olayları otomatik olarak feedback panosuna düşer.
        </p>
      </div>

      {loadingStatus ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="animate-spin" aria-hidden="true" />
          Durum kontrol ediliyor…
        </div>
      ) : isConnected ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <span aria-hidden="true">✓</span>
            <span>
              Linear bağlı
              {status?.record?.resourceTypes?.length
                ? ` · ${status.record.resourceTypes.join(", ")}`
                : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={disconnect}
              disabled={disconnecting}
            >
              {disconnecting && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Bağlantıyı kes
            </Button>
          </div>
        </div>
      ) : (
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
              API keys ekranından oluştur (admin olmalı).
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
      )}

      {error && (
        <Notice>
          {error}
        </Notice>
      )}
    </div>
  );
}
