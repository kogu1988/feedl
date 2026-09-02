"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PencilIcon, ReplyIcon, Trash2Icon } from "lucide-react";

import { CommentForm } from "@/components/custom/comment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trDateTimeFormatter } from "@/lib/post-format";

export interface CommentCardData {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt: Date | null;
  authorName: string | null;
  authorUserId: string;
}

// Sprint 24: tek yorum kartı — kendi yorumunu düzenle/sil, giriş yapan
// kullanıcı tek seviye yanıt yazabilir, admin her yorumu yönetebilir.
// Sunucu bileşeni tarihi Date olarak geçirir (RSC serileştirmesi destekler).
export function CommentCard({
  postId,
  isAdmin,
  isSignedIn,
  currentUserId,
  comment,
}: {
  postId: string;
  isAdmin: boolean;
  isSignedIn: boolean;
  currentUserId: string | null;
  comment: CommentCardData;
}) {
  const [editing, setEditing] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const canManage =
    Boolean(currentUserId) &&
    (currentUserId === comment.authorUserId || isAdmin);

  const saveEdit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Yorum güncellenemedi.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        "Bu yorum silinsin mi? Yanıtları da silinir, işlem geri alınamaz.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Yorum silinemedi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={
        comment.isInternal ? "border-amber-600/30 bg-amber-500/5" : undefined
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">
            {comment.authorName ?? "Üye"}
          </span>
          <span className="text-sm text-muted-foreground">
            {trDateTimeFormatter.format(comment.createdAt)}
          </span>
          {comment.editedAt ? (
            <span className="text-xs text-muted-foreground">(düzenlendi)</span>
          ) : null}
          {comment.isInternal ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              İç not
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <div className="grid gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="Yorumu düzenle"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>
                {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                  setError(null);
                }}
                disabled={busy}
              >
                İptal
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {comment.body}
          </p>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {!editing ? (
          <div className="flex flex-wrap items-center gap-1">
            {isSignedIn && !comment.isInternal ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyOpen((open) => !open)}
                disabled={busy}
              >
                <ReplyIcon className="size-4" aria-hidden="true" />
                Yanıtla
              </Button>
            ) : null}
            {canManage ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  <PencilIcon className="size-4" aria-hidden="true" />
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  <Trash2Icon className="size-4" aria-hidden="true" />
                  Sil
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {replyOpen ? (
          <div className="border-l-2 pl-4">
            <CommentForm
              postId={postId}
              isAdmin={isAdmin}
              parentId={comment.id}
              onCancel={() => setReplyOpen(false)}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
