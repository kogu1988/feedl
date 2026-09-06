"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2Icon, UnplugIcon, LockKeyholeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/custom/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinearIntegration } from "@/components/custom/linear-integration";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/custom/empty-state";

type Provider = "slack" | "zendesk" | "intercom" | "jira";

interface ProviderMeta {
  provider: Provider;
  name: string;
  description: string;
  fields: { key: string; label: string; placeholder?: string }[];
  apiKeyField: string;
  secretField?: string;
}

// Sprint 63g — per-workspace entegrasyon kartları (grid). Her kart bağlıysa
// durum + webhook URL gösterir; değilse credential alanlarıyla bağlanır.
// Linear ayrı bileşenden (mevcut). Slack/Zendesk/Intercom burada.
const PROVIDERS: ProviderMeta[] = [
  {
    provider: "jira",
    name: "Jira",
    description:
      "Jira issue'larını otomatik olarak feedl fikirlerine dönüştürür (webhook otomatik kaydedilir).",
    apiKeyField: "apiToken",
    fields: [
      { key: "baseUrl", label: "Site URL", placeholder: "https://acme.atlassian.net" },
      { key: "accountEmail", label: "Site E-postası", placeholder: "you@acme.com" },
      { key: "apiToken", label: "API Token", placeholder: "ATATT…" },
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "…" },
    ],
  },
  {
    provider: "slack",
    name: "Slack",
    description:
      "Slack kanalından gelen mesajları AI ile sınıflandırıp feedl feedback'ine çevirir.",
    apiKeyField: "botToken",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "xoxb-…" },
      { key: "webhookSecret", label: "Signing Secret", placeholder: "…" },
    ],
  },
  {
    provider: "zendesk",
    name: "Zendesk",
    description:
      "Zendesk ticket'larını otomatik olarak feedl fikirlerine dönüştürür.",
    apiKeyField: "apiKey",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "…" },
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "…" },
    ],
  },
  {
    provider: "intercom",
    name: "Intercom",
    description:
      "Intercom konuşmalarından gelen istekleri feedl'e akıtır.",
    apiKeyField: "accessToken",
    fields: [
      { key: "accessToken", label: "Access Token", placeholder: "…" },
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "…" },
    ],
  },
];

function ProviderCard({ meta, isPro }: { meta: ProviderMeta; isPro: boolean }) {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${meta.provider}/connect`);
      const json = await res.json();
      if (json.success && json.data?.status === "connected") {
        setStatus("connected");
        setWebhookUrl(json.data.webhookUrl ?? null);
      } else {
        setStatus("disconnected");
        setWebhookUrl(null);
      }
    } catch {
      setStatus("disconnected");
    }
  }, [meta.provider]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${meta.provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Bağlanılamadı.");
        return;
      }
      setStatus("connected");
      setWebhookUrl(json.data?.webhookUrl ?? null);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${meta.provider}/connect`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Bağlantı kesilemedi.");
        return;
      }
      setStatus("disconnected");
      setWebhookUrl(null);
      setValues({});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>{meta.name}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
          {status === "connected" ? (
            <Badge className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              Bağlı
            </Badge>
          ) : status === "disconnected" ? (
            <Badge className="border-border bg-muted text-muted-foreground">
              Bağlı değil
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {status === "connected" ? (
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
              <code className="mt-1 block break-all rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                {webhookUrl ?? "—"}
              </code>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                {busy ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <UnplugIcon className="size-4" />
                )}
                Bağlantıyı kes
              </Button>
            </div>
          </div>
        ) : !isPro ? (
          <div className="grid gap-3">
            <EmptyState title="Pro plan özelliğidir" className="border-0">
              Bu entegrasyonu bağlamak için Pro planına geç.
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
            {meta.fields.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`${meta.provider}-${field.key}`}>{field.label}</Label>
                <Input
                  id={`${meta.provider}-${field.key}`}
                  type="password"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  autoComplete="off"
                />
              </div>
            ))}
            {error ? <Notice>{error}</Notice> : null}
            <div>
              <Button size="sm" disabled={busy} onClick={() => void connect()}>
                {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Bağlan
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sprint 63o — entegrasyonlar Pro plan özelliğidir. Free workspace'te kartlar
// kilitlenir (Pro'ya Yükselt CTA) + üstte bilgilendirme bandı.
export function IntegrationsPanel({ isPro }: { isPro: boolean }) {
  return (
    <div className="grid gap-6">
      {!isPro ? (
        <Notice size="md">
          Entegrasyonlar (Slack, Zendesk, Intercom, Jira, Linear) Pro plan
          özelliğidir. Bağlamak için &quot;Pro&apos;ya Yükselt&quot; butonunu kullan.
        </Notice>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <LinearIntegration isPro={isPro} />
        {PROVIDERS.map((meta) => (
          <ProviderCard key={meta.provider} meta={meta} isPro={isPro} />
        ))}
      </div>
    </div>
  );
}
