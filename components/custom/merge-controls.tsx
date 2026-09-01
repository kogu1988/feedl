"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMergeIcon, Loader2Icon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MergeCandidate {
  id: string;
  title: string;
  voteCount: number;
}

// Sprint 20: admin merge kontrolleri (fikir detay sayfası, yalnızca admin
// render eder). Birleşmiş fikir için geri alma; birleşmemiş için arama +
// onaylı birleştirme. İşlem sonrası router.refresh() sunucu verisini
// tazeler.
export function MergeControls({
  postId,
  mergedInto,
}: {
  postId: string;
  mergedInto: { id: string; title: string } | null;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <GitMergeIcon className="size-3.5" aria-hidden="true" />
        Birleştirme (yalnızca admin)
      </p>
      {mergedInto ? (
        <UnmergePanel postId={postId} target={mergedInto} />
      ) : (
        <MergePanel postId={postId} />
      )}
    </div>
  );
}

function UnmergePanel({
  postId,
  target,
}: {
  postId: string;
  target: { id: string; title: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isWorking, setIsWorking] = useState(false);
  const router = useRouter();

  const unmerge = async () => {
    setError(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/admin/merge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: postId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Geri alma başarısız.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Bu fikir{" "}
        <a
          href={`/portal/${target.id}`}
          className="font-medium underline underline-offset-4"
        >
          {target.title}
        </a>{" "}
        ile birleştirildi. Oy ve yorumlar hedef fikirde.
      </p>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void unmerge()}
          disabled={isWorking || isPending}
        >
          {isWorking || isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <Undo2Icon className="size-4" aria-hidden="true" />
          )}
          Birleşmeyi geri al
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function MergePanel({ postId }: { postId: string }) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [selected, setSelected] = useState<MergeCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const search = async (value: string) => {
    setQuery(value);
    setSelected(null);
    setError(null);
    if (value.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: value.trim(), exclude: postId });
      const res = await fetch(`/api/admin/posts?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: MergeCandidate[];
      };
      setCandidates(res.ok && json.success ? (json.data ?? []) : []);
    } catch {
      setCandidates([]);
    } finally {
      setIsSearching(false);
    }
  };

  const merge = async () => {
    if (!selected) {
      return;
    }
    setError(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/admin/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: postId, targetId: selected.id }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Birleştirme başarısız.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Input
        value={query}
        onChange={(event) => void search(event.target.value)}
        placeholder="Hedef fikri başlığa göre ara..."
        aria-label="Hedef fikir araması"
      />
      {isSearching ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
          Aranıyor...
        </p>
      ) : null}
      {!isSearching && !selected && candidates.length > 0 ? (
        <ul className="grid gap-1">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setSelected(candidate)}
                className="w-full cursor-pointer rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="line-clamp-1 font-medium">
                  {candidate.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {candidate.voteCount} oy
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!isSearching && !selected && query.trim().length >= 2 && candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sonuç bulunamadı.</p>
      ) : null}
      {selected ? (
        <div className="grid gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Hedef:</span>{" "}
            <span className="font-medium">{selected.title}</span>
            <span className="text-xs text-muted-foreground">
              {" "}
              ({selected.voteCount} oy)
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Bu fikrin tüm oyları ve yorumları hedef fikre taşınır; işlem geri
            alınabilir.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void merge()}
              disabled={isWorking || isPending}
            >
              {isWorking || isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <GitMergeIcon className="size-4" aria-hidden="true" />
              )}
              Birleştir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={isWorking || isPending}
            >
              İptal
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
