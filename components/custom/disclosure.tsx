"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Sprint 63k — açılır-kapanır (accordion) kart. Varsayılan KAPALI; kullanıcı
// isterse açar. Erişilebilir: <button aria-expanded> + <div role="region">.
// Tasarım kanonu: Card kabuğu + başlık satırı + Chevron; içerik açılınca.
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
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-t-lg text-left"
      >
        <CardHeader className="py-4">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <ChevronDownIcon
          className={cn(
            "mr-4 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
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
