"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// Sprint 63k — açılır-kapanır (accordion) kart. Varsayılan KAPALI; kullanıcı
// isterse açar. Erişilebilir: <button aria-expanded> + <div role="region">.
// Başlık satırı solda (title + opsiyonel açıklama, min-w-0 flex-1 — uzun
// başlıkta sıkışma/taşma olmasın), sağda chevron; padding Card ile tutarlı.
export function Disclosure({
  title,
  description,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <Card className={cn("mt-8", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`disclosure-${id}`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-start justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="min-w-0 flex-1 grid gap-1">
          <span className="text-base font-semibold leading-snug">{title}</span>
          {description ? (
            <span className="text-sm text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <CardContent id={`disclosure-${id}`} role="region">
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
