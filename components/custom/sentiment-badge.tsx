import { sentimentLabels } from "@/lib/post-format";
import { cn } from "@/lib/utils";

// AI duygu analizi rozetinin tek görsel kaynağı (plan.md Sprint 11):
// Pozitif yeşil, Nötr nötr, Negatif gül kurusu.
const sentimentStyles: Record<string, string> = {
  pozitif:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  notr: "border-border bg-muted text-muted-foreground",
  negatif:
    "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        sentimentStyles[sentiment] ?? sentimentStyles.notr,
      )}
    >
      {sentimentLabels[sentiment] ?? sentiment}
    </span>
  );
}
