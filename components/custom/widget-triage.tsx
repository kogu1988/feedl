"use client";

import { useState } from "react";
import { SendIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Sprint 48l — widget AI triage. Kullanıcı serbest mesaj yazar; AI sınıflar:
// feedback → fikir oluşturur, support/clarify/unrecognized → yönlendirme.
// Sprint 63p — `ws` prop: workspace slug'ı; triage Pro gate'inin DOĞRU
// workspace üzerinden çalışması için fetch'e `?ws=` eklenir (anonim/read-only
// iframe'de session çerezi olmayabilir).
export function WidgetTriage({ ws }: { ws?: string | null }) {
  const wsParam = ws ? `?ws=${encodeURIComponent(ws)}` : "";
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    classification: string;
    response: string;
    postId?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/widget/triage${wsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "İşlenemedi.");
        return;
      }
      setResult(json.data);
      setMessage("");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <SparklesIcon className="size-3.5" aria-hidden="true" />
          Farklı bir konu mu?
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border bg-muted/40 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Bir şey yazın — size yardımcı olalım ya da geri bildirim olarak ekleyelim.
      </p>
      <form onSubmit={submit} className="grid gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Örn. Karanlık mod istiyorum / Ödeme sorunu yaşıyorum"
          aria-label="Mesajınız"
        />
        <Button type="submit" disabled={busy || message.trim().length < 3} size="sm">
          {busy ? "Analiz ediliyor…" : "Gönder"}
          <SendIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </form>

      {result ? (
        <div className="mt-3 rounded-md bg-background p-3 text-sm">
          <span className="mr-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
            {result.classification === "feedback"
              ? "Geri bildirim"
              : result.classification === "support"
                ? "Destek"
                : result.classification === "clarify"
                  ? "Netleştirme"
                  : "Anlaşılamadı"}
          </span>
          <p className="mt-1 text-muted-foreground">{result.response}</p>
          {result.postId ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Fikrin oluşturuldu. Teşekkürler!
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
