import Link from "next/link";

import { getPlanLimits } from "@/lib/paddle";

// Sprint 63u — "Powered by feedl" rozeti. FREE planlı workspace'te public
// yüzeylerde (portal / roadmap / changelog) gösterilir; Pro'da gizlenir —
// kullanıcı onaylı plan matrisi. Rozette plain "feedl" yerine HEADER'daki
// marka logosu (turuncu) kullanılır; tek kaynak (tek dosya).
// Pro değilse null döner (render etmez).
export async function PoweredByFeedl() {
  const planKey = (await getPlanLimits()).key;
  if (planKey !== "free") return null;

  return (
    <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_brand_orange.svg" alt="" className="size-4 shrink-0 object-contain" aria-hidden="true" />
      <span>Powered by</span>
      <Link
        href="https://feedl.app"
        className="font-medium underline-offset-4 hover:underline"
      >
        feedl
      </Link>
    </p>
  );
}
