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
// Pro rozeti rengi: `bg-brand/10 text-brand-strong border-brand/40`. Metin MUTLAKA
// `text-brand-strong` olmalı: marka tonlu zeminde (`bg-brand/10` → #ffefeb) ham
// `text-brand` (#ff5c35) yalnız 2.75:1 kontrast verir ve WCAG AA'yı (4.5:1) kırar.
// `--brand-strong` (#c7360f açık / #ff8c66 koyu) DESIGN.md'deki "açık zeminde
// metin (AA)" token'ıdır.
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
    <Badge
      className={cn("border-brand/40 bg-brand/10 text-brand-strong", className)}
    >
      {lock ? (
        <LockIcon className="mr-0.5 size-3" aria-hidden="true" />
      ) : null}
      {label}
    </Badge>
  );
}

// Free rozeti — ProBadge'in nötr eşi. Free/Pro karşılaştırması yapan yüzeylerde
// (rehber, plan karşılaştırması) iki rozet birlikte kullanılır ki etiket dili
// tek yerden gelsin. Nötr stil DESIGN.md'deki "nötr rozet" desenidir.
export function FreeBadge({
  className,
  label = "Free",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Badge className={cn("border-border bg-muted text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}

// Kilitli bir Pro özelliği için standart görünüm: üstte rozet, kısa açıklama ve
// "Pro'ya Yükselt" butonu. `compact` ise yer kazanır (widget/sohbet için) ama
// YİNE DE neyin yükseltileceğini söyleyen kısa bir açıklama gösterir — kullanıcı
// yükseltmenin neye karşılık geldiğini bilmeden tıklamaz.
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
      {title ? (
        <p
          className={cn(
            "font-medium",
            compact ? "mt-1 text-xs" : "mt-1.5 text-sm",
          )}
        >
          {title}
        </p>
      ) : null}
      {description ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
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
