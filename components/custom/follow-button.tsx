"use client";

import { useState } from "react";
import { BellPlusIcon, BellRingIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type FollowResponse = {
  success?: boolean;
  error?: string;
  data?: { following: boolean };
};

// Fikir takibi: POST ile takip et, DELETE ile bırak. Durum, sunucudan dönen
// zarfla güncellenir (optimistik UI yok). Takipten çıkmak oy/yorumları silmez.
export function FollowButton({
  postId,
  initialFollowing,
}: {
  postId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  const toggleFollow = async () => {
    if (pending) return;
    setPending(true);

    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(postId)}/follow`,
        { method: following ? "DELETE" : "POST" },
      );
      const json = (await res.json()) as FollowResponse;

      if (res.ok && json.success && json.data) {
        setFollowing(json.data.following);
      } else {
        console.error(
          "Follow toggle failed:",
          json.error ?? `HTTP ${res.status}`,
        );
      }
    } catch (err) {
      console.error(
        "Follow toggle network error:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      size="sm"
      onClick={toggleFollow}
      disabled={pending}
      aria-pressed={following}
      className="shrink-0 gap-1.5"
    >
      {following ? (
        <BellRingIcon className="size-4" aria-hidden="true" />
      ) : (
        <BellPlusIcon className="size-4" aria-hidden="true" />
      )}
      {following ? "Takipte" : "Takip Et"}
    </Button>
  );
}
