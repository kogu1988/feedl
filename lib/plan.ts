import "server-only";

import { NextResponse } from "next/server";

import { getPlanLimits } from "@/lib/paddle";

// Sprint 63o (plan matrisi netleştirme — kullanıcı onaylı) — ücretli özellik
// kapıları için ortak yardımcı. Pro olmayan workspace'te ücretli yeteneklerin
// API uçları 403 döner (defense-in-depth; UI da upsell gösterir). "Powered by
// feedl" rozeti gibi free/görünüm kararları da buraya dayanır.

// Pro değilse standart 403 dön; Pro ise null (izinli).
export async function requirePro(): Promise<NextResponse | null> {
  const plan = await getPlanLimits();
  if (plan.key === "pro") return null;
  return NextResponse.json(
    {
      success: false,
      error:
        "Bu özellik Pro plan özelliğidir. Kullanmak için Faturalandırma sayfasından Pro planına geç.",
    },
    { status: 403 },
  );
}

// Boolean: workspace pro mu? (UI'da upside dönüşümü / badge gizleme).
export async function isProPlan(): Promise<boolean> {
  return (await getPlanLimits()).key === "pro";
}
