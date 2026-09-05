import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type PageBreadcrumbItem = {
  label: string;
  href?: string;
};

// Alt sayfalarda konum bağlamı (DESIGN.md §4): üst sayfaya tek tıkla dönüş.
// Son öğe aria-current="page" ile geçerli sayfayı işaretler ve uzun
// başlıklarda tek satırda kırpılır. Yalnız alt sayfalarda kullanılır —
// tek seviyeli sayfalarda ve dashboard'da breadcrumb gerekmez.
export function PageBreadcrumb({
  items,
  className,
}: {
  items: PageBreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Sayfa yolu" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              {isLast ? (
                <span aria-current="page" className="truncate text-foreground">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link
                    href={item.href ?? "/"}
                    className="truncate underline-offset-4 transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                  <ChevronRightIcon
                    className="size-3.5 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
