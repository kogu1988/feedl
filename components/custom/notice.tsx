import { cn } from "@/lib/utils";

// Ortak bilgilendirme/hata kutusu — DESIGN.md §5 küçük eleman radius (rounded-md)
// standardı. Tüm form/manager satır içi hatalar ve sayfa yük hataları bu
// bileşenden geçer; kopya hata kutuları tek kaynağa iner.
// size="sm" → satır içi kompakt (px-3 py-2), size="md" → sayfa düzeyi blok (p-4).
// tone yalnızca anlamsal renk değiştirir; yapı sabittir.
export function Notice({
  children,
  className,
  tone = "error",
  size = "sm",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "error" | "info";
  size?: "sm" | "md";
}) {
  return (
    <p
      className={cn(
        "rounded-md border bg-destructive/10 text-sm text-destructive",
        size === "sm" ? "px-3 py-2" : "p-4",
        tone === "error"
          ? "border-destructive/30"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
