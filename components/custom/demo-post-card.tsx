import { MessageSquareIcon, ThumbsUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { cn } from "@/lib/utils";

// Sprint 50 (cilama) — portal fikir kartının GÖRSEL birebir karşılığı, ama
// etkileşimsiz (tıklanamaz). Landing + /demo örnekleri için tekil kaynak:
// aynı Badge/Button stilleri → proje geneli tutarlılık. Oy/etiket/yorum
// elemanları portaldaki VoteButton/CommentCountBadge/TagChips ile AYNI görünür
// (ThumbsUp, MessageSquare iconları, outline Button, rozetler) fakat
// tıklanamaz/bağlantısız.
export type DemoPostStatus = "open" | "under-review" | "planned" | "in-progress" | "shipped" | "closed";
export type DemoPostType = "feature" | "bug" | "usability";

export function DemoPostCard({
  title,
  date,
  status,
  type,
  sentiment,
  tags,
  description,
  voteCount,
  commentCount,
  className,
}: {
  title: string;
  date: string;
  status: DemoPostStatus;
  type: DemoPostType;
  sentiment: "pozitif" | "notr" | "negatif";
  tags: string[];
  description: string;
  voteCount: number;
  commentCount: number;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-snug">{title}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none shrink-0 gap-1.5"
          >
            <ThumbsUpIcon className="size-4" aria-hidden="true" />
            {voteCount}
          </Button>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-2">
          {date}
          <StatusBadge status={status} />
          <TypeBadge type={type} />
          <span className="inline-flex items-center gap-1">
            <MessageSquareIcon className="size-3.5" aria-hidden="true" />
            {commentCount} yorum
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SentimentBadge sentiment={sentiment} />
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
