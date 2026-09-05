import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { randomBytes } from "node:crypto";

import {
  deleteIntegration,
  integrationWebhookUrl,
  readIntegrationStatus,
  saveIntegration,
  type IntegrationProvider,
} from "@/lib/integrations";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { eq } from "drizzle-orm";
import { workspaces } from "@/lib/db/schema";

// Sprint 63g — per-workspace connect/disconnect için ortak handler.
// Provider'a özel credential alanları `credentialSchema` ile verilir;
// bunlar workspace_integrations.apiKey / webhookSecret alanlarına yazılır.
export function createIntegrationConnectHandler(
  provider: IntegrationProvider,
  credentialSchema: z.ZodSchema,
) {
  return {
    // Durum: bağlı mı + webhook URL'si (credential döndürülmez).
    async GET() {
      try {
        const adminId = await getAdminUserId();
        if (!adminId) {
          return NextResponse.json(
            { success: false, error: "Bu işlem için admin yetkisi gerekir." },
            { status: 403 },
          );
        }
        const status = await readIntegrationStatus(provider);
        return NextResponse.json({ success: true, data: status });
      } catch (err) {
        console.error(`GET /api/integrations/${provider}/connect failed:`, err);
        return NextResponse.json(
          { success: false, error: "Bağlantı durumu okunamadı." },
          { status: 500 },
        );
      }
    },

    // Bağlan: credential'ları doğrula ve kaydet; webhook URL döndür.
    async POST(req: Request) {
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
        const parsed = credentialSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Gerekli alanlar eksik veya geçersiz." },
            { status: 400 },
          );
        }
        const creds = parsed.data as {
          apiKey?: string | null;
          webhookSecret?: string | null;
          webhookId?: string | null;
          resourceTypes?: string[];
        };
        const saved = await saveIntegration(provider, {
          apiKey: creds.apiKey ?? null,
          webhookSecret: creds.webhookSecret ?? null,
          webhookId: creds.webhookId ?? null,
          resourceTypes: creds.resourceTypes ?? null,
          status: "connected",
        });
        const [slugRow] = await getDb()
          .select({ slug: workspaces.slug })
          .from(workspaces)
          .where(eq(workspaces.id, await getWorkspaceId()))
          .limit(1);
        const slug = slugRow?.slug ?? "feedl";
        const webhookUrl = integrationWebhookUrl(provider, slug, saved.urlToken);
        return NextResponse.json({ success: true, data: { status: "connected", webhookUrl } });
      } catch (err) {
        console.error(`POST /api/integrations/${provider}/connect failed:`, err);
        return NextResponse.json(
          { success: false, error: "Bağlanılamadı. Lütfen tekrar deneyin." },
          { status: 500 },
        );
      }
    },

    // Bağlantıyı kes.
    async DELETE() {
      try {
        const adminId = await getAdminUserId();
        if (!adminId) {
          return NextResponse.json(
            { success: false, error: "Bu işlem için admin yetkisi gerekir." },
            { status: 403 },
          );
        }
        await deleteIntegration(provider);
        return NextResponse.json({ success: true, data: { status: "disconnected" } });
      } catch (err) {
        console.error(`DELETE /api/integrations/${provider}/connect failed:`, err);
        return NextResponse.json(
          { success: false, error: "Bağlantı kesilemedi." },
          { status: 500 },
        );
      }
    },
  };
}

export function generateWebhookId(): string {
  return randomBytes(16).toString("hex");
}

export const slackConnectSchema = z.object({
  webhookSecret: z.string().trim().min(10, "Slack Signing Secret en az 10 karakter.").max(300),
  botToken: z.string().trim().min(1, "Slack Bot Token gerekli.").max(300),
});

export const zendeskConnectSchema = z.object({
  webhookSecret: z.string().trim().min(10, "Zendesk webhook secret en az 10 karakter.").max(300),
  apiKey: z.string().trim().min(1, "Zendesk API key gerekli.").max(300),
});

export const intercomConnectSchema = z.object({
  accessToken: z.string().trim().min(1, "Intercom access token gerekli.").max(300),
  webhookSecret: z.string().trim().min(10, "Intercom webhook secret en az 10 karakter.").max(300),
});
