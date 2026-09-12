import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  linearDataText,
  parseLinearPayload,
  verifyLinearSignatureWithSecret,
} from "@/lib/linear";
import { posts, users, workspaceIntegrations, workspaces } from "@/lib/db/schema";
import { urlTokenMatches } from "@/lib/integrations";
import { decryptSecret } from "@/lib/encrypt";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";
import { enforceInboundWebhookRateLimit } from "@/lib/rate-limit";

// Sprint 56/58 (madde 2) — Linear webhook. Workspace webhook URL →
// Issue/Comment/CustomerNeed → AI triage → feedback. Doğrulama
// `X-Linear-Signature` (gövde HMAC-SHA256).
// Per-workspace: URL `?ws=<slug>&t=<token>` → workspace kaydındaki secret ile
// doğrular ve o workspace'e işler. `?ws=&t=` ZORUNLUDUR; token'sız (legacy)
// yol 2026-09-12 (Faz 3) emekliye ayrıldı — gerekçe ve ölçüm:
// app/api/integrations/intercom/webhook/route.ts.
export async function POST(req: NextRequest) {
  try {
    // Rate limit ÖNCE: imza/iş kuralı maliyetinden önce flood'u reddet.
    const rateLimited = await enforceInboundWebhookRateLimit(req, "linear");
    if (rateLimited) return rateLimited;

    const rawBody = await req.text();
    const signature = req.headers.get("x-linear-signature") ?? "";

    // Per-workspace çözümleme (Sprint 58).
    //
    // DİKKAT: bu değişken İSTEK-LOKAL olmak ZORUNDA. 2026-09-12 kod
    // incelemesinde modül seviyesinde (`let workspaceIdOverride`) tutulduğu ve
    // hiçbir yerde sıfırlanmadığı görüldü; serverless'ta warm instance aynı
    // modülü yeniden kullandığı için değer BİR SONRAKİ isteğe sızıyordu:
    // `?ws=acme` isteğinden sonra gelen parametresiz istek, kendi workspace'i
    // yerine acme'nin workspace'ine yazıyordu → cross-tenant yazma. Legacy
    // (parametresiz) yol artık 403 ile reddedilse de fonksiyon-lokal kalması
    // şarttır: iki farklı workspace'e giden ardışık istekler yine interleave
    // olabilir. Fonksiyon-lokal değişken her çağrıda kendi yığınında yaşar,
    // sızıntı yapısal olarak imkânsız hale gelir.
    // Regresyon testi: tests/lib/linear-webhook-tenant.test.ts
    let resolvedWorkspaceId: string | null = null;

    const wsParam = req.nextUrl.searchParams.get("ws");
    const tokenParam = req.nextUrl.searchParams.get("t");
    if (!wsParam || !tokenParam) {
      return NextResponse.json(
        { success: false, error: "Webhook adresinde ?ws=&t= parametreleri gerekli." },
        { status: 403 },
      );
    }
    // `workspaces.id` ilk sorguda gelir — aynı slug'ı ikinci kez sorgulamaya
    // gerek yok (eski kodda fazladan bir DB turu vardı).
    const [record] = await getDb()
      .select({
        webhookSecret: workspaceIntegrations.webhookSecret,
        urlToken: workspaceIntegrations.urlToken,
        workspaceId: workspaces.id,
      })
      .from(workspaceIntegrations)
      .innerJoin(workspaces, eq(workspaces.id, workspaceIntegrations.workspaceId))
      .where(
        and(
          eq(workspaceIntegrations.provider, "linear"),
          eq(workspaces.slug, wsParam),
        ),
      )
      .limit(1);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Linear entegrasyonu bulunamadı." },
        { status: 404 },
      );
    }
    if (!urlTokenMatches(record.urlToken, tokenParam)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Linear webhook token." },
        { status: 401 },
      );
    }
    // Sprint 63t — webhookSecret şifreli saklanır; imza doğrulama için çözülür.
    const webhookSecret = decryptSecret(record.webhookSecret);
    if (!webhookSecret || !verifyLinearSignatureWithSecret(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Linear imzası." },
        { status: 401 },
      );
    }
    resolvedWorkspaceId = record.workspaceId;

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz JSON." },
        { status: 400 },
      );
    }
    const { type, data } = parseLinearPayload(payload as Record<string, unknown>);
    if (!data) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const { title, body: message } = linearDataText(type, data);
    if (!message) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const result = await classifyWidgetMessage(message);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      // Per-workspace webhook'ta ?ws= slug'ından çözülen id; yoksa host tabanlı default.
      const workspaceId = resolvedWorkspaceId ?? (await getWorkspaceId());
      // Sprint 48q: aynı Linear Issue/Comment (id) tekrar post edilmesin.
      const sourceRef = data.id ? `linear:${data.id}` : null;
      if (sourceRef) {
        const [existing] = await getDb()
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.workspaceId, workspaceId), eq(posts.sourceRef, sourceRef)))
          .limit(1);
        if (existing) {
          return NextResponse.json({
            success: true,
            data: { classification, postId: existing.id, duplicate: true },
          });
        }
      }

      const identity = data.id ?? "linear";
      const userId = toWidgetUserId(`linear_${identity}`);
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `linear-${identity}@widget.feedl.local`,
          name: data.team?.name ?? null,
          role: "customer",
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { updatedAt: new Date() },
        });

      const [created] = await getDb()
        .insert(posts)
        .values({
          workspaceId,
          boardId: await getDefaultBoardId(),
          userId,
          title,
          description: message,
          source: "linear",
          ...(sourceRef ? { sourceRef } : {}),
        })
        .returning({ id: posts.id, title: posts.title });
      createdPostId = created.id;
      try {
        await inngest.send({
          name: "post/created",
          data: postCreatedEventSchema.parse({
            postId: created.id,
            title: created.title,
            description: message,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error("linear post/created send failed:", eventErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, postId: createdPostId },
    });
  } catch (err) {
    console.error("POST /api/integrations/linear/webhook failed:", err);
    return NextResponse.json(
      { success: false, error: "Linear event işlenemedi." },
      { status: 500 },
    );
  }
}
