import { statusLabels } from "@/lib/post-format";

import { Badge } from "@/components/ui/badge";

// Durum etiketinin tek görsel kaynağı (plan.md Sprint 9): portal, roadmap
// ve dialog aynı renk dilini kullanır — Açık nötr, İncelemede menekşe,
// Planlandı mavi, Geliştiriliyor amber, Yayınlandı yeşil, Kapatıldı gri.
// Görsel kabuk ui/badge (Badge), renk buradaki haritadan.
const statusStyles: Record<string, string> = {
  open: "border-border bg-muted text-muted-foreground",
  "under-review":
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  planned: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "in-progress":
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  shipped:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  closed: "border-border bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusStyles[status] ?? statusStyles.open}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}
