"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Üst bardaki koyu mod anahtarı. Sunucuda tema bilinemediği için ikon ve
// konum mount'a kadar çizilmez; hydration uyarısı ve yanıp sönme önlenir.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Koyu mod"
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        isDark ? "border-brand bg-brand" : "border-input bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 flex size-4.5 items-center justify-center rounded-full bg-card shadow-sm transition-transform",
          isDark && "translate-x-[22px]",
        )}
      >
        {isDark ? (
          <MoonIcon className="size-3 text-foreground" />
        ) : (
          <SunIcon
            className={cn("size-3", mounted && "text-muted-foreground")}
          />
        )}
      </span>
    </button>
  );
}
