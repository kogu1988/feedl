"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2Icon, LockKeyholeIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { EmptyState } from "@/components/custom/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Sprint 58/63k — per-workspace Linear entegrasyon kartı (IntegrationsPanel
// grid'inde diğer provider kartlarıyla AYNI Card standardı). Bağlanmamışsa:
// API key gir → POST /api/integrations/linear/connect (Linear webhook'u otomatik
// oluşturur). Bağlıysa: durum gösterir + "Bağlantıyı kes" (DELETE).

interface LinearStatus {
  connected: boolean;
  record?: {
    status: string;
    resourceTypes: string[];
    linearTeamId: string | null;
    createdAt: string;
  };
}

export function LinearIntegration({ isPro }: { isPro: boolean }) {
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Linear</CardTitle>
            <CardDescription>
              Linear issue&apos;ları otomatik olarak feedl fikirlerine dönüştürür
              (webhook otomatik kaydedilir).
            </CardDescription>
          </div>
          {isConnected ? (
            <Badge className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              Bağlı
            </Badge>
          ) : (
            <Badge className="border-border bg-muted text-muted-foreground">
              Bağlı değil
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingStatus ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            Durum kontrol ediliyor…
          </div>
        ) : isConnected ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <span aria-hidden="true">✓</span>{" "}
              Linear bağlı
              {status?.record?.resourceTypes?.length
                ? ` · ${status.record.resourceTypes.join(", ")}`
                : ""}
            </div>
            <div>
              <Button
                variant="outline"
                onClick={disconnect}
                disabled={disconnecting}
              >
                {disconnecting && <Loader2Icon className="size-4 animate-spin" />}
                Bağlantıyı kes
              </Button>
            </div>
          </div>
        ) : !isPro ? (
          <div className="grid gap-3">
            <EmptyState title="Pro plan özelliğidir" className="border-0">
              Linear&apos;ı bağlamak için Pro planına geç.
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                render={<Link href="/dashboard/billing" />}
              >
                <LockKeyholeIcon className="size-4" />
                Pro&apos;ya Yükselt
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-3">
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
            <div>
              <Button onClick={connect} disabled={connecting}>
                {connecting && <Loader2Icon className="size-4 animate-spin" />}
                Linear&apos;ı bağla
              </Button>
            </div>
          </div>
        )}
        {error ? <Notice>{error}</Notice> : null}
      </CardContent>
    </Card>
  );
}
