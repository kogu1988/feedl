"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

// Sunucu bileşenleri için hafif sekme/parametre navigasyonu (plan.md
// Sprint 12): seçim URL query param'ıyla taşınır, sayfa sunucuda yeniden
// render edilir. value "" ana path'e (parametresiz) gider — yani varsayılan.
// extraParams: diğer filtre parametrelerini korumak için (örn. sort sekmesi
// açıkken tag filtresi değişince ?sort=new kaybolmasın — Sprint 21).
// Sprint 33 sonrası: tıklama router.push + useTransition ile yapılır —
// tam sayfa yenilenmeden, kaydırma atlamadan; sekme hemen seçili görünür
// (optimistik), liste yeni RSC verisi gelince sessizce değişir.
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const activeValue = optimistic ?? active;

  useEffect(() => {
    // Geçiş bittiğinde sunucudan gelen active devralır.
    if (!isPending) {
      setOptimistic(null);
    }
  }, [isPending]);

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

  const select = (value: string, href: string) => {
    if (value === activeValue) {
      return;
    }
    setOptimistic(value);
    startTransition(() => router.push(href, { scroll: false }));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      {options.map((option) => {
        const href = suffix(option.value);
        const isActive = option.value === activeValue;
        const isPendingOption = isPending && optimistic === option.value;
        return (
          <Link
            key={option.value || "default"}
            href={href}
            scroll={false}
            onClick={(event) => {
              // Yardımcı tuşlarla (yeni sekme vb.) açılırken tarayıcıya izin ver.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              select(option.value, href);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              isPendingOption && "animate-pulse",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
