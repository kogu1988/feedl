import Link from "next/link";
import { LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sprint 64 — Pro/yükseltme STANDART tasarım şablonu. Proje genelinde aynı
// marka kimliği (mercan/turuncu) ile "Pro" işareti + "Pro'ya Yükselt" çağrısı
// kullanılır. Kaynak: integrations-panel / workspace-settings / pricing-manager
// desenleri tek kaynağa indirildi — kopya "Pro" rozeti ve kilitli kart yazılmaz.
//
// Pro rozeti rengi: `bg-brand/10 text-brand border-brand/40` (mercan + WCAG).
// Yükseltme CTA: `/dashboard/billing`'e giden birincil (size lg) buton.

export function ProBadge({
  className,
  label = "Pro",
  lock = false,
}: {
  className?: string;
  label?: string;
  lock?: boolean;
}) {
  return (
    <Badge className={cn("border-brand/40 bg-brand/10 text-brand", className)}>
      {lock ? (
        <LockIcon className="mr-0.5 size-3" aria-hidden="true" />
      ) : null}
      {label}
    </Badge>
  );
}

// Kilitli bir Pro özelliği için standart görünüm: üstte rozet, kısa açıklama ve
// "Pro'ya Yükselt" butonu. `compact` ise yalnız rozet + buton (yer kazanır) —
// widget/sohbet gibi küçük alanlar için.
export function ProFeatureLock({
  title = "Bu özellik Pro",
  description,
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-brand/20 bg-brand/5 p-3 text-center",
        compact ? "py-2" : "py-3",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        {!compact ? (
          <LockIcon className="size-3.5 text-brand" aria-hidden="true" />
        ) : null}
        <ProBadge />
      </div>
      {!compact && title ? (
        <p className="mt-1.5 text-sm font-medium">{title}</p>
      ) : null}
      {!compact && description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className={cn("flex", compact ? "mt-1.5" : "mt-3")}>
        <Button
          size={compact ? "sm" : "lg"}
          className="w-full"
          render={<Link href="/dashboard/billing" />}
        >
          Pro&apos;ya Yükselt
        </Button>
      </div>
    </div>
  );
}
