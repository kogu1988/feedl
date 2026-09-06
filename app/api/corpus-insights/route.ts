import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";

// Sprint 63l — corpus AI içgörülerini ARKA PLANDA tetikle (dashboard/insights
// "Yenile" butonu). Sayfa LLM çağrısını engellemez; Inngest üretir ve cache'ler.
// Team (owner/admin/contributor) erişebilir; member → portal.
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
