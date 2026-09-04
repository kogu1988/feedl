import Link from "next/link";

import { FilterTabs } from "@/components/custom/filter-tabs";

// Sprint 39: sunucuda render edilen sayfalama alt bilgisi. Kayıt adedi
// seçici FilterTabs ile taşınır — per değişince page sıfırlanır (extraParams
// içinde page bilinçli olarak yok). Önceki/Sonraki düz Link'tir; Next
// varsayılanı yeni sayfanın başına kaydırır. "Tümü" seçiliyken veya tek
// sayfa varken sayfa linkleri gizlenir.
export function PaginationFooter({
  basePath,
  page,
  totalPages,
  per,
  extraParams,
  pageParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  per: string;
  extraParams?: Record<string, string>;
  pageParams?: Record<string, string>;
}) {
  const hrefFor = (target: number) => {
    const extras = new URLSearchParams(pageParams ?? {});
    if (target > 1) {
      extras.set("page", String(target));
    } else {
      extras.delete("page");
    }
    const qs = extras.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const hasPages = per !== "all" && totalPages > 1;

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-4"
      aria-label="Sayfalama"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Kayıt adedi</span>
        <FilterTabs
          paramName="per"
          basePath={basePath}
          active={per === "5" ? "" : per}
          options={[
            { value: "", label: "5" },
            { value: "25", label: "25" },
            { value: "50", label: "50" },
            { value: "all", label: "Tümü" },
          ]}
          extraParams={extraParams}
        />
      </div>
      {hasPages ? (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              className="rounded-md border px-3 py-1.5 font-medium transition-colors hover:bg-accent"
              aria-label="Önceki sayfa"
            >
              Önceki
            </Link>
          ) : (
            <span
              className="rounded-md border px-3 py-1.5 font-medium text-muted-foreground opacity-50"
              aria-disabled="true"
            >
              Önceki
            </span>
          )}
          <span className="text-muted-foreground">
            Sayfa {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={hrefFor(page + 1)}
              className="rounded-md border px-3 py-1.5 font-medium transition-colors hover:bg-accent"
              aria-label="Sonraki sayfa"
            >
              Sonraki
            </Link>
          ) : (
            <span
              className="rounded-md border px-3 py-1.5 font-medium text-muted-foreground opacity-50"
              aria-disabled="true"
            >
              Sonraki
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
