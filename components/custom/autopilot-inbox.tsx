"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, InboxIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface InboxSuggestionItem {
  id: string;
  postId: string;
  type: "duplicate";
  confidence: number;
  note: string;
  targetId: string;
  targetTitle: string | null;
  sourceTitle: string;
  createdAtLabel: string;
}

// Sprint 33: Autopilot Inbox — AI'ın duplicate tespit ettiği fakat admin
// onayı bekleyen öneriler. Onay Sprint 20 merge CTE'sini çalıştırır; red/
// yoksay yalnızca öneriyi kapatır. İşlem sonrası router.refresh() tazeler.
export function AutopilotInbox({
  suggestions,
}: {
  suggestions: InboxSuggestionItem[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const decide = async (
    suggestionId: string,
    action: "approve" | "reject" | "ignore",
  ) => {
    setError(null);
    setMessage(null);
    setBusyId(suggestionId);
    try {
      const res = await fetch(`/api/admin/inbox/${suggestionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { alreadyMerged?: boolean; movedVotes?: number };
      };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Karar kaydedilemedi.");
        return;
      }
      if (action === "approve") {
        setMessage(
          json.data?.alreadyMerged
            ? "Fikir zaten birleştirilmişti; öneri kapatıldı."
            : `Fikirler birleştirildi (${json.data?.movedVotes ?? 0} oy taşındı).`,
        );
      } else {
        setMessage(action === "reject" ? "Öneri reddedildi." : "Öneri yoksayıldı.");
      }
      router.refresh();
    } catch {
      setError("Karar kaydedilemedi. Bağlantını kontrol et.");
    } finally {
      setBusyId(null);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-6">
        <InboxIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Bekleyen öneri yok. AI yeni fikirlerde duplicate tespit ettiğinde
          burada listelenir.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="rounded-lg border p-4 transition-colors"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {suggestion.sourceTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {suggestion.createdAtLabel} · güven %{suggestion.confidence}
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Muhtemelen tekrar
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{suggestion.note}</p>

          {suggestion.targetTitle ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Önerilen hedef:{" "}
              <Link
                href={`/portal/${suggestion.targetId}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {suggestion.targetTitle}
              </Link>
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busyId === suggestion.id}
              onClick={() => decide(suggestion.id, "approve")}
            >
              <CheckIcon className="size-4" aria-hidden="true" />
              Onayla ve Birleştir
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === suggestion.id}
              onClick={() => decide(suggestion.id, "reject")}
            >
              <XIcon className="size-4" aria-hidden="true" />
              Reddet
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === suggestion.id}
              onClick={() => decide(suggestion.id, "ignore")}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Yoksay
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
