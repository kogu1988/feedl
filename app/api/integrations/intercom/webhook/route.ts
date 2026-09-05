import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  intercomConversationText,
  isIntercomConfigured,
  parseIntercomPayload,
  verifyIntercomWebhook,
} from "@/lib/intercom";
import { posts, users } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 48r — Intercom webhook. Developer Hub Webhooks → conversation.user.created
// (kullanıcı/lead'den yeni mesaj) → AI triage → feedback oluştur.
// Doğrulama app_id üzerinden (Intercom imza başlığı göndermez); ayrıca
// opsiyonel INTERCOM_WEBHOOK_SECRET ile `X-Intercom-Signature` desteklenir.
export async function POST(req: NextRequest) {
  try {
    if (!isIntercomConfigured()) {
      return NextResponse.json(
        { success: false, error: "Intercom yapılandırılmamış (INTERCOM_APP_ID yok)." },
        { status: 503 },
      );
    }

    const rawBody = await req.text();
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

    if (!verifyIntercomWebhook(body, rawBody, req.headers)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Intercom webhook (app_id/imeza)." },
        { status: 401 },
      );
    }

    const { item, topic } = parseIntercomPayload(body);
    if (!item || !item.conversationMessage?.body) {
      // İlgisiz/boş event (ör. conversation.updated, hiç mesaj yok) — sessizce 200.
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    // Sadece kullanıcı/lead yeni mesajı ele al (topic filtre ekstra güvenlik).
    if (topic && !["conversation.user.created", "conversation.user.updated"].includes(topic)) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const { title, body: message } = intercomConversationText(item);
    if (!message) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const result = await classifyWidgetMessage(message);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      const workspaceId = await getWorkspaceId();
      // Sprint 48q: aynı Intercom conversation'ı (id) tekrar post edilmesin.
      const conversationId = item.id;
      const sourceRef = conversationId ? `intercom:${conversationId}` : null;
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

      // Contact id varsa onu, yoksa conversation id'yi kimlik olarak kullan.
      const identity = item.contact?.id ?? conversationId ?? "conversation";
      const userId = toWidgetUserId(`intercom_${identity}`);
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `intercom-${identity}@widget.feedl.local`,
          name: item.contact?.name ?? null,
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
          source: "intercom",
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
        console.error("intercom post/created send failed:", eventErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, postId: createdPostId },
    });
  } catch (err) {
    console.error("POST /api/integrations/intercom/webhook failed:", err);
    return NextResponse.json(
      { success: false, error: "Intercom event işlenemedi." },
      { status: 500 },
    );
  }
}
