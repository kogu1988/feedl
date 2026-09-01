import { statusLabels } from "@/lib/post-format";
import { cn } from "@/lib/utils";

// Durum etiketinin tek görsel kaynağı (plan.md Sprint 9): portal, roadmap
// ve dialog aynı renk dilini kullanır — Açık nötr, Planlandı mavi,
// Geliştiriliyor amber, Yayınlandı yeşil.
const statusStyles: Record<string, string> = {
  open: "border-border bg-muted text-muted-foreground",
  planned: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "in-progress":
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  shipped:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        statusStyles[status] ?? statusStyles.open,
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
