"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon, UnplugIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/custom/notice";
import { LinearIntegration } from "@/components/custom/linear-integration";

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

function ProviderCard({ meta }: { meta: ProviderMeta }) {
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
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{meta.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
        </div>
        {status === "connected" ? (
          <span className="inline-flex items-center rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Bağlı
          </span>
        ) : status === "disconnected" ? (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Bağlı değil
          </span>
        ) : null}
      </div>

      {status === "connected" ? (
        <div className="mt-4 grid gap-3">
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
      ) : (
        <div className="mt-4 grid gap-3">
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
    </div>
  );
}

// Sprint 63g — setup'taki entegrasyon ızgarası. Linear mevcut kart + üç yeni.
export function IntegrationsPanel() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <LinearIntegration />
      {PROVIDERS.map((meta) => (
        <ProviderCard key={meta.provider} meta={meta} />
      ))}
    </div>
  );
}
