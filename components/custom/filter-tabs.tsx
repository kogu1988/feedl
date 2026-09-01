import Link from "next/link";

import { cn } from "@/lib/utils";

// Sunucu bileşenleri için hafif sekme/parametre navigasyonu (plan.md
// Sprint 12): seçim URL query param'ıyla taşınır, sayfa sunucuda yeniden
// render edilir. value "" ana path'e (parametresiz) gider — yani varsayılan.
// extraParams: diğer filtre parametrelerini korumak için (örn. sort sekmesi
// açıkken tag filtresi değişince ?sort=new kaybolmasın — Sprint 21).
export function FilterTabs({
  paramName,
  basePath,
  options,
  active,
  extraParams,
}: {
  paramName: string;
  basePath: string;
  options: { value: string; label: string }[];
  active: string;
  extraParams?: Record<string, string>;
}) {
  const suffix = (value: string) => {
    if (value === "") {
      const extras = new URLSearchParams(extraParams ?? {});
      const qs = extras.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    }
    const extras = new URLSearchParams({
      ...extraParams,
      [paramName]: value,
    });
    return `${basePath}?${extras.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <Link
          key={option.value || "default"}
          href={suffix(option.value)}
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
