"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Sprint 32: dashboard/widget sayfasının etkileşimli bölümü — test jetonu
// üretir (POST /api/admin/widget-token) ve embed snippet'ini jetonla
// doldurur. Üretimde jetonu müşterinin kendi backend'i imalar; bu form
// MVP/test amaçlıdır. Sprint 41: vurgu rengi + tema seçimi snippet'e
// data-accent / data-theme olarak yansır (varsayılanlar snippet'e yazılmaz).
const ACCENT_DEFAULT = "#111827";

export function WidgetSetup({ baseUrl }: { baseUrl: string }) {
  const [sub, setSub] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [accent, setAccent] = useState(ACCENT_DEFAULT);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"snippet" | null>(null);

  const snippet = [
    `<script`,
    `  src="${baseUrl}/widget.js"`,
    `  data-feedl-url="${baseUrl}"`,
    ...(token ? [`  data-token="${token}"`] : []),
    `  data-button-text="Geri bildirim"`,
    ...(accent.toLowerCase() !== ACCENT_DEFAULT
      ? [`  data-accent="${accent.toLowerCase()}"`]
      : []),
    ...(theme !== "light" ? [`  data-theme="${theme}"`] : []),
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
          2) Widget görünümünü ayarlayın. Vurgu rengi launcher butonuna
          uygulanır; yazı rengi seçtiğiniz rengin parlaklığına göre otomatik
          belirlenir.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <input
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              className="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Vurgu rengi"
            />
            <span className="text-muted-foreground">Vurgu rengi</span>
            <code className="ml-auto text-xs uppercase text-muted-foreground">
              {accent.toUpperCase()}
            </code>
          </label>
          <select
            value={theme}
            onChange={(event) =>
              setTheme(event.target.value as "light" | "dark" | "auto")
            }
            aria-label="Tema"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="light">Tema: Açık</option>
            <option value="dark">Tema: Koyu</option>
            <option value="auto">Tema: Sistem</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          3) Aşağıdaki kodu kendi sitenizin HTML&apos;ine ekleyin
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
