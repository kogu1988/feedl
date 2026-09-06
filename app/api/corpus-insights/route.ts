import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getTeamUserId } from "@/lib/auth/admin";
import { getPlanLimits } from "@/lib/paddle";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";

// Sprint 63l — corpus AI içgörülerini ARKA PLANDA tetikle (dashboard/insights
// "Yenile" butonu). Sayfa LLM çağrısını engellemez; Inngest üretir ve cache'ler.
// Team (owner/admin/contributor) erişebilir; member → portal.
// Sprint 63n — LLM maliyet koruması: kullanıcı başına 5/saat + workspace başına
// 3/15dk (peşpeşe "Yenile" sonrası bile kaynak tüketmez). Upstash Redis
// (checkRateLimit) + in-process fallback.
export async function POST() {
  try {
    const teamId = await getTeamUserId();
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için yetki gerekir." },
        { status: 403 },
      );
    }
    const workspaceId = await getWorkspaceId();

    // İçgörü Pro özelliği (kullanıcı): free workspace LLM maliyeti üretmesin.
    const planKey = (await getPlanLimits()).key;
    if (planKey !== "pro") {
      return NextResponse.json(
        { success: false, error: "AI İçgörüleri Pro plan özelliğidir. Yükseltmek için Faturalama sayfasını kullan." },
        { status: 403 },
      );
    }

    // Rate limit (LLM maliyet amplifikasyonunu kes): kullanıcı başına 5 analiz/saat.
    const userRl = await enforceRateLimit("corpus-insights:user", teamId, {
      limit: 5,
      windowSec: 3600,
    });
    if (!userRl.allowed) return userRl.response!;
    // Workspace başına 3 analiz/15 dk (hızlı tekrar denemeleri keser).
    const wsRl = await enforceRateLimit("corpus-insights:ws", workspaceId, {
      limit: 3,
      windowSec: 900,
    });
    if (!wsRl.allowed) return wsRl.response!;

    // Spring 63m: analiz zaten sürüyorsa tekrar event GÖNDERME (kaynak zorlama
    // önlenir) — kullanıcı peşpeşe "Yenile"ye bassa da tek analiz sürer.
    const [row] = await getDb()
      .select({ status: workspaces.corpusInsightsStatus })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (row?.status === "pending") {
      return NextResponse.json({ success: true, data: { queued: false, status: "pending" } });
    }

    // İşlem kuyruğa girer; status 'pending' olarak fonksiyon başlarken set edilir.
    await inngest.send({
      name: "corpus-insights.request",
      data: { workspaceId },
    });

    return NextResponse.json({ success: true, data: { queued: true } });
  } catch (err) {
    console.error(
      "POST /api/corpus-insights failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Analiz başlatılamadı." },
      { status: 500 },
    );
  }
}
