import * as React from "react";

import { cn } from "@/lib/utils";

// Sprint 63w (F4) — native `<select>` için TEK standart kabuk. Tüm açılır
// listelerin kapalı alanı aynı görünür; `option` popup teması globals.css'teki
// global `select option` kuralından beslenir (tek kaynak). Sadece native select
// sarar — boyut/görünüm chip'lere uygun (parent genişliğe uyar).
function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
