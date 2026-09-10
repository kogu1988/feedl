import { getPlanLimits } from "@/lib/paddle";

import { PoweredByFeedlMark } from "@/components/custom/powered-by-feedl-mark";

// Sprint 63u — "Powered by feedl" rozeti. FREE planlı workspace'te public
// yüzeylerde (portal / roadmap / changelog) gösterilir; Pro'da gizlenir —
// kullanıcı onaylı plan matrisi. Markup tek kaynak: PoweredByFeedlMark
// (widget paneli de aynı işareti kullanır).
// Pro değilse null döner (render etmez).
export async function PoweredByFeedl() {
  const planKey = (await getPlanLimits()).key;
  if (planKey !== "free") return null;

  return <PoweredByFeedlMark />;
}
