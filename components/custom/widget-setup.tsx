"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Sprint 32: dashboard/widget sayfasının etkileşimli bölümü — test jetonu
// üretir (POST /api/admin/widget-token) ve embed snippet'ini jetonla
// doldurur. Üretimde jetonu müşterinin kendi backend'i imalar; bu form
// MVP/test amaçlıdır.
export function WidgetSetup({ baseUrl }: { baseUrl: string }) {
  const [sub, setSub] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"snippet" | null>(null);

  const snippet = [
    `<script`,
    `  src="${baseUrl}/widget.js"`,
    `  data-feedl-url="${baseUrl}"`,
    ...(token ? [`  data-token="${token}"`] : []),
    `  data-button-text="Geri bildirim"`,
    `></script>`,
  ].join("\n");

  async function generateToken() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/widget-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: sub.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok || typeof json !== "object" || json === null) {
        throw new Error("istek başarısız");
      }
      const body = json as { success?: boolean; data?: { token?: string } };
      const nextToken = body.data?.token;
      if (!body.success || typeof nextToken !== "string" || !nextToken) {
        throw new Error("jeton üretilemedi");
      }
      setToken(nextToken);
    } catch {
      setError(
        "Jeton üretilemedi. Kimlik alanını kontrol edin (yalnızca harf, rakam, - ve _).",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied("snippet");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* pano izni yoksa sessizce yut */
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          1) Test için bir widget kimliği üretin. Üretimde müşteri
          uygulamanızın backend&apos;i bu jetonu kendi sunucusunda imalar
          (aşağıdaki Node.js örneği) — bu form yalnızca denemek içindir.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            value={sub}
            onChange={(event) => setSub(event.target.value)}
            placeholder="Kimlik (örn. retha-42)"
            maxLength={64}
            aria-label="Widget kullanıcı kimliği"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="İsim (opsiyonel)"
            maxLength={120}
            aria-label="Widget kullanıcı adı"
          />
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-posta (opsiyonel)"
            maxLength={254}
            aria-label="Widget kullanıcı e-postası"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={generateToken}
            disabled={loading || sub.trim().length === 0}
            className="gap-2"
          >
            <KeyRoundIcon className="size-4" aria-hidden="true" />
            {loading ? "Üretiliyor..." : "Jeton Üret (1 saatlik)"}
          </Button>
          {token ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Jeton hazır — snippet&apos;e gömüldü.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          2) Aşağıdaki kodu kendi sitenizin HTML&apos;ine ekleyin
          {token
            ? " — jeton gömülü, ziyaretçi kimliğiyle fikir gönderebilir ve oy verebilir."
            : " — jetonsuz widget salt-okunur liste olarak açılır."}
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
          <code>{snippet}</code>
        </pre>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copySnippet}
            className="gap-2"
          >
            {copied === "snippet" ? (
              <CheckIcon className="size-4" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-4" aria-hidden="true" />
            )}
            {copied === "snippet" ? "Kopyalandı" : "Snippet'i Kopyala"}
          </Button>
        </div>
      </div>
    </div>
  );
}
