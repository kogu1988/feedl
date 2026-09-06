"use client";

import Link from "next/link";
import { MessageSquareIcon, ThumbsUpIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CommentCountBadge } from "@/components/custom/comment-count-badge";
import { cn } from "@/lib/utils";

// Sprint 63m — TEK fikir kartı (tek tasarım kaynağı). Portal, roadmap ve
// changelog'daki fikir/duyuru kartları aynı köşe düzenini kullanır:
//   sol üst: başlık + rozetler (yeterli boşlukla)
//   sol alt: etiketler (opsiyonel) + açıklama metni
//   sağ üst: tarih (opsiyonel)
//   sağ alt: oy + yorum (varsa) / aksiyonlar
// Kullanıcı kararı: kopya kart düzenleri silinir, hepsi bu bileşenden türetilir.
export interface IdeaCardProps {
  title: string;
  // F5: href opsiyonel — verilirse başlık Link, verilmezse mock (demo/landing)
  // için link'siz <span> (tıklanamaz).
  href?: string;
  // Mock/demo yüzeylerinde (landing) ekran okuyucudan gizle (etkileşimsiz görsel).
  ariaHidden?: boolean;
  // Rozetler: status/type/sentiment/label vb. ReactNode'lar (araları gap-2).
  badges?: React.ReactNode;
  // Sağ üstteki tarih (opsiyonel).
  date?: string;
  // Açıklama / gövde (opsiyonel). Uzun metinde line-clamp desteklenir.
  description?: string;
  lineClamp?: number;
  // Başlık altındaki etiket/anahtar chip'leri (opsiyonel).
  tags?: React.ReactNode;
  // Sağ alt istatistikler: oy + yorum (id varsa CommentCountBadge).
  voteCount?: number;
  voteAction?: React.ReactNode; // VoteButton / giriş-oy butonu
  commentCount?: number;
  commentPostId?: string;
  // İsteğe bağlı ek içerik (roadmap drag, changelog image/body/links).
  content?: React.ReactNode;
  // Dış stiller / drag davranışı (roadmap).
  className?: string;
  // İçerik alanı için ekstra alt içerik (content yerine) — changelog.
  // Roadmap drag-and-drop desteği.
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLElement>;
}

export function IdeaCard({
  title,
  href,
  ariaHidden,
  badges,
  date,
  description,
  lineClamp,
  tags,
  voteCount,
  voteAction,
  commentCount,
  commentPostId,
  content,
  className,
  draggable,
  onDragStart,
}: IdeaCardProps) {
  const hasStats = Boolean(voteAction || commentCount != null || voteCount != null);
  return (
    <Card
      aria-hidden={ariaHidden || undefined}
      className={cn("transition-[transform,box-shadow] duration-150 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-xs dark:hover:ring-foreground/25", className)}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <CardContent className="p-4">
        <div className="flex justify-between gap-4">
          {/* SOL: başlık + rozetler (üst) → etiketler + metin (alt) */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {href ? (
                <Link
                  href={href}
                  className="text-base font-semibold leading-snug underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {title}
                </Link>
              ) : (
                <span className="text-base font-semibold leading-snug">{title}</span>
              )}
              {badges}
            </div>
            {tags ? <div className="mt-2">{tags}</div> : null}
            {description ? (
              <p
                className={cn(
                  "mt-2 whitespace-pre-line text-sm text-muted-foreground",
                  lineClamp ? `line-clamp-${lineClamp}` : undefined,
                )}
              >
                {description}
              </p>
            ) : null}
          </div>

          {/* SAĞ: tarih (üst) → oy/yorum (alt) */}
          {(date || hasStats) && (
            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              {date ? (
                <span className="text-xs text-muted-foreground">{date}</span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                {/* F5: mock (commentPostId yok) → statik sayı; gerçek → link. */}
                {commentCount != null && commentPostId ? (
                  <CommentCountBadge postId={commentPostId} count={commentCount} />
                ) : commentCount != null ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <MessageSquareIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{commentCount}</span>
                  </span>
                ) : null}
                {voteAction ? voteAction : voteCount != null ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <ThumbsUpIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{voteCount}</span>
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {content ? <div className="mt-3">{content}</div> : null}
      </CardContent>
    </Card>
  );
}
