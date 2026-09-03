"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// next-themes'in ince sarmalayıcısı. (main) layout'unda kullanılır;
// /widget bare root layout'ta kaldığı için temadan etkilenmez.
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...props} />;
}
