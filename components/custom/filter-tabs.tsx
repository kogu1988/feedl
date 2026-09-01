import Link from "next/link";

import { cn } from "@/lib/utils";

// Sunucu bileşenleri için hafif sekme/parametre navigasyonu (plan.md
// Sprint 12): seçim URL query param'ıyla taşınır, sayfa sunucuda yeniden
// render edilir. value "" ana path'e (parametresiz) gider — yani varsayılan.
export function FilterTabs({
  paramName,
  basePath,
  options,
  active,
}: {
  paramName: string;
  basePath: string;
  options: { value: string; label: string }[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <Link
          key={option.value || "default"}
          href={
            option.value === ""
              ? basePath
              : `${basePath}?${paramName}=${option.value}`
          }
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            option.value === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
