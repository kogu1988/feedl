import { typeLabels } from "@/lib/post-format";
import { cn } from "@/lib/utils";

// Fikir türü etiketinin tek görsel kaynağı (Sprint 21 — StatusBadge
// pattern'i): Özellik mavi, Hata kırmızı, Kullanılabilirlik mor.
const typeStyles: Record<string, string> = {
  feature: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  bug: "border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-400",
  usability:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        typeStyles[type] ?? typeStyles.feature,
      )}
    >
      {typeLabels[type] ?? type}
    </span>
  );
}
