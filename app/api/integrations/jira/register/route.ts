import { NextRequest, NextResponse } from "next/server";

import {
  isJiraConfigured,
  jiraAuthReady,
  registerJiraWebhook,
} from "@/lib/jira";

// Sprint 58 (madde 2) — Jira otomatik webhook kaydı. Müşteri elle Jira
// Automation kuralı kurmaz; API token ile biz `rest/webhooks/1.0` üzerinden
// issue_created/issue_updated webhook'unu kaydederiz. Bu uç, workspace
// ayarlarından (veya admin tarafından) tetiklenir. İsteğe bağlı güvenlik:
// JIRA_REGISTER_SECRET header'ı eşleşirse çalışır; yoksa 401.
export async function POST(req: NextRequest) {
  try {
    // İsteğe bağlı admin koruması: JIRA_REGISTER_SECRET tanımlıysa kontrol et.
    const registerSecret = process.env.JIRA_REGISTER_SECRET;
    if (registerSecret) {
      const provided = req.headers.get("x-register-secret") ?? "";
      if (provided !== registerSecret) {
        return NextResponse.json(
          { success: false, error: "Geçersiz kayıt anahtarı." },
          { status: 401 },
        );
      }
    }

    if (!isJiraConfigured() || !jiraAuthReady()) {
      return NextResponse.json(
        {
          success: false,
          error: "Jira yapılandırılmamış (JIRA_WEBHOOK_SECRET / JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN).",
        },
        { status: 503 },
      );
    }

    const token = process.env.JIRA_WEBHOOK_SECRET!;
    const result = await registerJiraWebhook(token);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("POST /api/integrations/jira/register failed:", err);
    return NextResponse.json(
      { success: false, error: "Jira webhook kaydı başarısız." },
      { status: 500 },
    );
  }
}
