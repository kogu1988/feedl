import { MessageSquareIcon, ThumbsUpIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { cn } from "@/lib/utils";

// Sprint 50 (cilama) + 63m — portal fikir kartının GÖRSEL birebir karşılığı
// (IdeaCard köşe düzeni: başlık+rozetler sol üst, tarih sağ üst, etiketler+metin
// sol, oy+yorum sağ alt), ama etkileşimsiz (tıklanamaz / aria-hidden). Landing +
// /demo için tek kaynak — gerçek IdeaCard ile aynı görünüm.
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
      <CardContent className="p-4">
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold leading-snug">{title}</span>
              <StatusBadge status={status} />
              <TypeBadge type={type} />
              <SentimentBadge sentiment={sentiment} />
            </div>
            {tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} className="border-border bg-muted text-muted-foreground">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end justify-between gap-3">
            <span className="text-xs text-muted-foreground">{date}</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm">
                <MessageSquareIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono tabular-nums">{commentCount}</span>
              </span>
              <span className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm">
                <ThumbsUpIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono tabular-nums">{voteCount}</span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
