import * as React from "react";

import { cn } from "@/lib/utils";

// Ortak rozet kabuğu (DESIGN.md §5: rozet `rounded-full`, küçük eleman).
// Semantik renk (status/type/sentiment) üst katmanda `className` ile verilir —
// bu bileşen yalnız görsel kabuğu (pill) sağlar, kopya kabuk tek kaynağa iner.
function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
