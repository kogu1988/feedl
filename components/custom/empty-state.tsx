import * as React from "react";

import { cn } from "@/lib/utils";

// Ortak boş durum çerçevesi (DESIGN.md §5: kart/gövde `rounded-lg`, kesikli
// kenarlık). Liste boş durumlarında `size="sm"` (p-6), tam sayfa/hero boş
// durumlarında `size="lg"` (p-10). `title` (font-medium), `children` (açıklama)
// ve `action` (CTA) parçaları opsiyonel — kopya boş durum kutuları tek kaynağa
// iner.
export function EmptyState({
  size = "sm",
  title,
  children,
  action,
  className,
}: {
  size?: "sm" | "lg";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed text-center",
        size === "sm" ? "p-6" : "p-10",
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? (
        <p
          className={cn(
            "text-sm text-muted-foreground",
            title ? "mt-1" : undefined,
          )}
        >
          {children}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
