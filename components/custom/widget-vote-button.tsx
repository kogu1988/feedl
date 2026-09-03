"use client";

import { useState } from "react";
import { ThumbsUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type VoteResponse = {
  success?: boolean;
  error?: string;
  data?: { voted: boolean; voteCount: number };
};

// Widget oy butonu (plan.md Sprint 32): portal VoteButton ile aynı davranış,
// /api/widget/votes uçlarını kullanır (kimlik widget çerezinden çözülür).
// Oturum yoksa buton pasif kalır — liste salt-okunur izlenir.
export function WidgetVoteButton({
  postId,
  initialCount,
  initialVoted,
  authenticated,
}: {
  postId: string;
  initialCount: number;
  initialVoted: boolean;
  authenticated: boolean;
}) {
  const [voteCount, setVoteCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, setPending] = useState(false);

  if (!authenticated) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="shrink-0 gap-1.5"
      >
        <ThumbsUpIcon className="size-4" aria-hidden="true" />
        {initialCount}
      </Button>
    );
  }

  const toggleVote = async () => {
    if (pending) return;
    setPending(true);

    try {
      const url = voted
        ? `/api/widget/votes?postId=${encodeURIComponent(postId)}`
        : "/api/widget/votes";
      const res = await fetch(url, {
        method: voted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: voted ? undefined : JSON.stringify({ postId }),
      });
      const json = (await res.json()) as VoteResponse;

      if (res.ok && json.success && json.data) {
        setVoted(json.data.voted);
        setVoteCount(json.data.voteCount);
      } else {
        console.error(
          "Widget vote toggle failed:",
          json.error ?? `HTTP ${res.status}`,
        );
      }
    } catch (err) {
      console.error(
        "Widget vote network error:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={voted ? "default" : "outline"}
      size="sm"
      onClick={() => {
        void toggleVote();
      }}
      disabled={pending}
      aria-pressed={voted}
      className="shrink-0 gap-1.5"
    >
      <ThumbsUpIcon className="size-4" aria-hidden="true" />
      {voteCount}
      <span className="sr-only">{voted ? "oyunu geri al" : "oy ver"}</span>
    </Button>
  );
}
