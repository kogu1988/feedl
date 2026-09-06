import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaceIntegrations, workspaces } from "@/lib/db/schema";
import { linearCreateWebhook, linearDeleteWebhook, linearViewer } from "@/lib/linear-api";
import { requirePro } from "@/lib/plan";

// Sprint 58 (madde 2) — per-workspace Linear otomasyonu.
// Workspace admin'i Linear API key girer → biz Linear GraphQL `webhookCreate`
// ile webhook'u OTOMATİK oluştururuz (Linear UI'da manuel kural YOK) →
// secret + id kaydedilir → entegrasyon hazır.
// URL'ye per-workspace token gömülür (?ws=<slug>&t=<urlToken>).

const LINEAR_RESOURCE_TYPES = ["Issue", "Comment", "CustomerNeed"];

const connectSchema = z.object({
  apiKey: z.string().trim().min(1, "Linear API key gerekli.").max(300),
  teamId: z.string().trim().max(100).optional().nullable(),
});

function randomToken(): string {
  return randomBytes(32).toString("hex");
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
    const proErr = await requirePro();
    if (proErr) return proErr;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Linear API key geçersiz." },
        { status: 400 },
      );
    }
    const apiKey = parsed.data.apiKey;
    const teamId = parsed.data.teamId || null;

    // API key'i doğrula (viewer sorgusu) — geçersizse erken dön.
    const viewer = await linearViewer(apiKey);
    if (!viewer) {
      return NextResponse.json(
        { success: false, error: "Linear API key geçersiz. Settings > Account > Security & Access'ten yeni key oluştur." },
        { status: 400 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [workspace] = await getDb()
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace bulunamadı." },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
    const urlToken = randomToken();
    const webhookUrl = `${appUrl}/api/integrations/linear/webhook?ws=${encodeURIComponent(workspace.slug)}&t=${encodeURIComponent(urlToken)}`;

    const created = await linearCreateWebhook(apiKey, {
      label: "feedl",
      url: webhookUrl,
      resourceTypes: LINEAR_RESOURCE_TYPES,
      allPublicTeams: !teamId,
      teamId,
    });
    if (!created.ok || !created.webhook) {
      return NextResponse.json(
        { success: false, error: created.error ?? "Linear webhook oluşturulamadı." },
        { status: 502 },
      );
    }

    // Yeni kaydı yaz (upsert: workspace+provider benzersiz).
    // apiKey, webhook silme/refresh için saklanır (Canny modeli).
    await getDb()
      .insert(workspaceIntegrations)
      .values({
        workspaceId,
        provider: "linear",
        webhookId: created.webhook.id,
        apiKey,
        webhookSecret: created.webhook.secret ?? null,
        urlToken,
        resourceTypes: LINEAR_RESOURCE_TYPES,
        linearTeamId: teamId,
        status: "connected",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [workspaceIntegrations.workspaceId, workspaceIntegrations.provider],
        set: {
          webhookId: created.webhook.id,
          apiKey,
          webhookSecret: created.webhook.secret ?? null,
          urlToken,
          resourceTypes: LINEAR_RESOURCE_TYPES,
          linearTeamId: teamId,
          status: "connected",
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      data: { webhookId: created.webhook.id, viewer: viewer.viewer },
    });
  } catch (err) {
    console.error("POST /api/integrations/linear/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Linear bağlantısı kurulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

// GET — mevcut Linear bağlantı durumu (UI yüklerken). Admin-only.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const [record] = await getDb()
      .select({
        provider: workspaceIntegrations.provider,
        status: workspaceIntegrations.status,
        resourceTypes: workspaceIntegrations.resourceTypes,
        linearTeamId: workspaceIntegrations.linearTeamId,
        createdAt: workspaceIntegrations.createdAt,
      })
      .from(workspaceIntegrations)
      .where(
        and(
          eq(workspaceIntegrations.workspaceId, await getWorkspaceId()),
          eq(workspaceIntegrations.provider, "linear"),
        ),
      )
      .limit(1);
    return NextResponse.json({
      success: true,
      data: { connected: Boolean(record), record: record ?? null },
    });
  } catch (err) {
    console.error("GET /api/integrations/linear/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Linear bağlantı durumu alınamadı." },
      { status: 500 },
    );
  }
}

// DELETE — Linear bağlantısını kes. Linear webhook'unu uzaktan silmeyi dener
// (sakladığımız apiKey ile), ardından workspace_integrations kaydını kaldırır.
export async function DELETE() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [record] = await getDb()
      .select({
        id: workspaceIntegrations.id,
        webhookId: workspaceIntegrations.webhookId,
        apiKey: workspaceIntegrations.apiKey,
      })
      .from(workspaceIntegrations)
      .where(
        and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(workspaceIntegrations.provider, "linear"),
        ),
      )
      .limit(1);

    let remoteDeleted = false;
    if (record?.webhookId && record.apiKey) {
      const rm = await linearDeleteWebhook(record.apiKey, record.webhookId);
      remoteDeleted = rm.ok;
    }

    // Yerel kaydı her durumda kaldır (remote silinemese bile UI
    // bağlantısız görünmeli; Linear tarafında kalan webhook zararsızdır).
    await getDb()
      .delete(workspaceIntegrations)
      .where(eq(workspaceIntegrations.id, record?.id ?? ""));

    if (!record) {
      return NextResponse.json({ success: true, data: { disconnected: true } });
    }

    return NextResponse.json({
      success: true,
      data: { disconnected: true, remoteDeleted },
    });
  } catch (err) {
    console.error("DELETE /api/integrations/linear/connect failed:", err);
    return NextResponse.json(
      { success: false, error: "Linear bağlantısı kesilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
