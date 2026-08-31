"use client";

import { useState } from "react";
import { ThumbsUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type VoteResponse = {
  success?: boolean;
  error?: string;
  data?: { voted: boolean; voteCount: number };
};

// Kart başına tek oy butonu: POST ile ver, DELETE ile geri al.
// Sayı ve durum, sunucudan dönen zarfla güncellenir (optimistik UI yok).
export function VoteButton({
  postId,
  initialCount,
  initialVoted,
}: {
  postId: string;
  initialCount: number;
  initialVoted: boolean;
}) {
  const [voteCount, setVoteCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, setPending] = useState(false);

  const toggleVote = async () => {
    if (pending) return;
    setPending(true);

    try {
      const url = voted
        ? `/api/votes?postId=${encodeURIComponent(postId)}`
        : "/api/votes";
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
          "Vote toggle failed:",
          json.error ?? `HTTP ${res.status}`,
        );
      }
    } catch (err) {
      console.error(
        "Vote toggle network error:",
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
      onClick={toggleVote}
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
