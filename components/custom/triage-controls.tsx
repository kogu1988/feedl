"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, TagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Faz 3 (AI öğrenme) — admin bu fikri "ilgisiz" işaretler (Feedly mute muadili).
// İşaret ai_triage_signals'a yazılır; autopilot yeni fikirleri sınıflandırırken
// bu workspace'in ilgisiz örneklerini bağlama katar. İşaret kaldırılınca sinyal
// silinir. Post detayında yalnızca admin render eder.
export function TriageControls({
  postId,
  triageLabel,
}: {
  postId: string;
  triageLabel: string | null;
}) {
  const marked = triageLabel === "not_relevant";
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function setNotRelevant(next: boolean) {
    setError(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          triageLabel: next ? "not_relevant" : null,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "İşaret kaydedilemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsWorking(false);
    }
  }

  const busy = isWorking || isPending;

  return (
    <div className="grid gap-2 rounded-md border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <TagIcon className="size-3.5" aria-hidden="true" />
        AI triage (yalnızca admin)
      </p>
      <p className="text-xs text-muted-foreground">
        İlgisiz olarak işaretlersen AI gelecekteki benzer içerikleri bu eğilime
        göre değerlendirir.
      </p>
      {marked ? (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Bu fikir ilgisiz olarak işaretlendi.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void setNotRelevant(false)}
            disabled={busy}
          >
            {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
            İşareti kaldır
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void setNotRelevant(true)}
          disabled={busy}
        >
          {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
          İlgisiz olarak işaretle
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
