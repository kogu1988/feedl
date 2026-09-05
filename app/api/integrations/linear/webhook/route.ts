import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  isLinearConfigured,
  linearDataText,
  parseLinearPayload,
  verifyLinearSignature,
  verifyLinearSignatureWithSecret,
} from "@/lib/linear";
import { posts, users, workspaceIntegrations, workspaces } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Per-workspace webhook'ta workspace id override'ı (host-tabanlı
// getWorkspaceId webhook'ta çalışmaz; ?ws= slug'ından çözeriz).
let workspaceIdOverride: string | null = null;

// Sprint 56/58 (madde 2) — Linear webhook. Workspace webhook URL →
// Issue/Comment/CustomerNeed → AI triage → feedback. Doğrulama
// `X-Linear-Signature` (gövde HMAC-SHA256).
// Per-workspace: URL `?ws=<slug>&t=<token>` → workspace kaydındaki secret ile
// doğrular ve o workspace'e işler. Geriye dönük: `?ws=` yoksa global
// LINEAR_WEBHOOK_SECRET + default workspace (mevcut manuel webhook).
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-linear-signature") ?? "";

    // Per-workspace çözümleme (Sprint 58).
    const wsParam = req.nextUrl.searchParams.get("ws");
    const tokenParam = req.nextUrl.searchParams.get("t");
    if (wsParam && tokenParam) {
      const [record] = await getDb()
        .select({ id: workspaceIntegrations.id, webhookSecret: workspaceIntegrations.webhookSecret, urlToken: workspaceIntegrations.urlToken })
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
      if (!record.urlToken || tokenParam !== record.urlToken) {
        return NextResponse.json(
          { success: false, error: "Geçersiz Linear webhook token." },
          { status: 401 },
        );
      }
      if (!verifyLinearSignatureWithSecret(rawBody, signature, record.webhookSecret)) {
        return NextResponse.json(
          { success: false, error: "Geçersiz Linear imzası." },
          { status: 401 },
        );
      }
      // Workspace id'yi query'de taşı (getWorkspaceId host tabanlı — webhook
      // bunu çözemez). slug→workspace id'yi yeniden bul.
      const [wsRow] = await getDb()
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, wsParam))
        .limit(1);
      if (!wsRow) {
        return NextResponse.json(
          { success: false, error: "Workspace bulunamadı." },
          { status: 404 },
        );
      }
      workspaceIdOverride = wsRow.id;
    } else {
      // Geriye dönük: global secret + default workspace.
      if (!isLinearConfigured()) {
        return NextResponse.json(
          { success: false, error: "Linear yapılandırılmamış (LINEAR_WEBHOOK_SECRET yok)." },
          { status: 503 },
        );
      }
      if (!verifyLinearSignature(rawBody, signature)) {
        return NextResponse.json(
          { success: false, error: "Geçersiz Linear imzası." },
          { status: 401 },
        );
      }
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
    const { action, type, data } = parseLinearPayload(payload as Record<string, unknown>);
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
      const workspaceId = workspaceIdOverride ?? (await getWorkspaceId());
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
