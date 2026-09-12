import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import { parseSlackMessage, verifySlackSignature } from "@/lib/slack";
import { resolveIntegrationByUrlToken } from "@/lib/integrations";
import { posts, users } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";
import { enforceInboundWebhookRateLimit } from "@/lib/rate-limit";

// Sprint 48o — Slack Events API webhook. Slack app bu URL'ye mesaj event'i
// POST eder; imza doğrulanır, message → AI triage → feedback oluşturulur.
// Sprint 63g: per-workspace — webhook URL `?ws=<slug>&t=<urlToken>` taşır ve
// ilgili workspace'in signing secret'ı workspace_integrations'dan çözülür.
// `?ws&t` ZORUNLUDUR; token'sız (legacy/env) yol 2026-09-12 (Faz 3) emekliye
// ayrıldı — gerekçe ve ölçüm: app/api/integrations/intercom/webhook/route.ts.
export async function POST(req: NextRequest) {
  try {
    // Rate limit ÖNCE (2026-09-12 incelemesi: bu uçta hiç limit yoktu).
    const rateLimited = await enforceInboundWebhookRateLimit(req, "slack");
    if (rateLimited) return rateLimited;

    // Per-workspace context: ?ws&t varsa workspace_integrations'tan çöz.
    const { searchParams } = req.nextUrl;
    const wsParam = searchParams.get("ws");
    const tokenParam = searchParams.get("t");
    let integrationSecret: string | null = null;
    let workspaceId: string | null = null;
    if (wsParam && tokenParam) {
      const resolved = await resolveIntegrationByUrlToken("slack", wsParam, tokenParam);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: "Geçersiz Slack webhook token." },
          { status: 403 },
        );
      }
      integrationSecret = resolved.webhookSecret;
      workspaceId = resolved.workspaceId;
      // Env'e düşen legacy fallback'i kapat: per-workspace kaydında imza
      // anahtarı yoksa doğrulama global SLACK_SIGNING_SECRET'e düşmemeli.
      if (!integrationSecret) {
        return NextResponse.json(
          { success: false, error: "Slack entegrasyonunda imza anahtarı tanımlı değil." },
          { status: 503 },
        );
      }
    } else {
      // 2026-09-12 (Faz 3): legacy (parametresiz) yol EMEKLİYE AYRILDI —
      // gerekçe ve ölçüm: app/api/integrations/intercom/webhook/route.ts.
      return NextResponse.json(
        { success: false, error: "Webhook adresinde ?ws=&t= parametreleri gerekli." },
        { status: 403 },
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-slack-signature") ?? "";
    const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
    if (!verifySlackSignature(rawBody, signature, timestamp, integrationSecret)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Slack imzası." },
        { status: 401 },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz JSON." },
        { status: 400 },
      );
    }
    const body = payload as Record<string, unknown>;

    // Slack kurulum doğrulaması.
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    const incoming = parseSlackMessage(body);
    if (!incoming) {
      // İlgisiz event (bot mesajı vb.) — sessizce 200.
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    // Mesajı AI ile sınıfla.
    const result = await classifyWidgetMessage(incoming.text);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      // Sprint 48q: idempotency — aynı Slack mesajı (event_ts) tekrar gelirse
      // yeni post oluşturma (Slack retry/çift event).
      const targetWorkspaceId = workspaceId ?? (await getWorkspaceId());
      const sourceRef = incoming.eventTs
        ? `slack:${incoming.eventTs}`
        : `slack:${incoming.userId ?? "unknown"}:${Date.now()}`;
      const [existing] = await getDb()
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.workspaceId, targetWorkspaceId), eq(posts.sourceRef, sourceRef)))
        .limit(1);
      if (existing) {
        return NextResponse.json({
          success: true,
          data: { classification, postId: existing.id, duplicate: true },
        });
      }
      const userId = incoming.userId
        ? toWidgetUserId(incoming.userId)
        : toWidgetUserId("slack");
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `${incoming.userId ?? "slack"}@widget.feedl.local`,
          name: null,
          role: "customer",
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { updatedAt: new Date() },
        });
      const title =
        incoming.text.split("\n").find((line) => line.trim())?.slice(0, 140) ??
        "Yeni geri bildirim";
      const [created] = await getDb()
        .insert(posts)
        .values({
          workspaceId: targetWorkspaceId,
          boardId: await getDefaultBoardId(),
          userId,
          title,
          description: incoming.text,
          source: "slack",
          sourceRef,
        })
        .returning({ id: posts.id, title: posts.title });
      createdPostId = created.id;
      try {
        await inngest.send({
          name: "post/created",
          data: postCreatedEventSchema.parse({
            postId: created.id,
            title: created.title,
            description: incoming.text,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error("slack post/created send failed:", eventErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, postId: createdPostId },
    });
  } catch (err) {
    console.error("POST /api/integrations/slack/events failed:", err);
    return NextResponse.json(
      { success: false, error: "Slack event işlenemedi." },
      { status: 500 },
    );
  }
}
