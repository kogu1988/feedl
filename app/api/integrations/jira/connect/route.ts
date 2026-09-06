// Sprint 63g — Jira per-workspace connect.
// Jira'dan Linear'dan farklıdır: baseUrl + email + apiToken gerekir; ayrıca
// webhook'u Otomatik kaydederiz (listJiraWebhooks + registerJiraWebhook).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { registerJiraWebhook } from "@/lib/jira";
import {
  integrationWebhookUrl,
  saveIntegration,
  readIntegrationStatus,
  deleteIntegration,
  randomIntegrationToken,
} from "@/lib/integrations";

const jiraConnectSchema = z.object({
  baseUrl: z.string().trim().url("Geçerli bir Jira URL gerekli.").max(300),
  accountEmail: z.string().trim().email("Geçerli e-posta gerekli.").max(200),
  apiToken: z.string().trim().min(1, "Jira API token gerekli.").max(300),
  webhookSecret: z
    .string()
    .trim()
    .min(10, "Webhook secret en az 10 karakter.")
    .max(300),
});

export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const status = await readIntegrationStatus("jira");
    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    console.error("GET /api/integrations/jira/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Bağlantı durumu okunamadı." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
    const parsed = jiraConnectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Gerekli alanlar eksik veya geçersiz." },
        { status: 400 },
      );
    }
    const creds = parsed.data;

    // Per-workspace webhook URL + token (biz webhook'u Jira'ya kaydedeceğiz).
    const [slugRow] = await getDb()
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, await getWorkspaceId()))
      .limit(1);
    const slug = slugRow?.slug ?? "feedl";
    const urlToken = randomIntegrationToken();
    const webhookUrl = integrationWebhookUrl("jira", slug, urlToken);

    // Jira webhook'unu otomatik kaydet (per-workspace creds + scoped URL).
    let webhookId: string | null = null;
    try {
      const reg = await registerJiraWebhook(creds.webhookSecret, {
        baseUrl: creds.baseUrl,
        email: creds.accountEmail,
        token: creds.apiToken,
      }, webhookUrl);
      webhookId = reg.webhookId != null ? String(reg.webhookId) : null;
    } catch (regErr) {
      // Kayıt başarısızsa yine de kaydı karmaşık duruma sokmadan hata bildir.
      console.error("jira webhook register failed:", regErr);
      return NextResponse.json(
        { success: false, error: "Jira webhook'u kaydedilemedi; bilgileri kontrol et." },
        { status: 502 },
      );
    }

    await saveIntegration("jira", {
      apiKey: creds.apiToken,
      webhookSecret: creds.webhookSecret,
      baseUrl: creds.baseUrl,
      accountEmail: creds.accountEmail,
      urlToken,
      webhookId,
      status: "connected",
    });
    return NextResponse.json({ success: true, data: { status: "connected", webhookUrl } });
  } catch (err) {
    console.error("POST /api/integrations/jira/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Bağlanılamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    // Not: Jira webhook'unu uzaktan silmek ekstra Jira API çağrısı gerektirir;
    // şimdilik kaydı kaldırırız (Linear pattern). İleride webhookId ile silinebilir.
    await deleteIntegration("jira");
    return NextResponse.json({ success: true, data: { status: "disconnected" } });
  } catch (err) {
    console.error("DELETE /api/integrations/jira/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Bağlantı kesilemedi." },
      { status: 500 },
    );
  }
}
