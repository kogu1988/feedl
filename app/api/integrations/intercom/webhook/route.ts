import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  intercomIdentity,
  intercomItemText,
  intercomSourceRef,
  isIntercomConfigured,
  parseIntercomPayload,
  verifyIntercomWebhook,
} from "@/lib/intercom";
import { posts, users } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 48r — Intercom webhook. Developer Hub Webhooks → konuşma/ticket
// olayları (`conversation.user.created`, `ticket.created`/`.updated`) →
// AI triage → feedback oluştur. Doğrulama app_id üzerinden (Intercom imza
// başlığı göndermez); ayrıca opsiyonel INTERCOM_WEBHOOK_SECRET ile
// `X-Intercom-Signature` desteklenir.
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
    // Hem conversation.* hem ticket.* topic'leri işlenir: Intercom'ta müşteri
    // mesajı conversation (`conversation.user.created`) olarak, ticket oluşturma
    // (`ticket.created`) olarak gelebilir. Güvenlik app_id doğrulamasında,
    // mesaj gövdesi yoksa aşağıda ignored döner.
    if (topic && !topic.startsWith("conversation") && !topic.startsWith("ticket")) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    if (!item || typeof item !== "object") {
      // İlgisiz/boş event (ör. data.item yok) — sessizce 200.
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const { title, body: message } = intercomItemText(item, topic);
    if (!message) {
      // Teşhis: geçerli webhook ama mesaj gövdesi bulunamadı — gerçek payload
      // yapısını görmek için ayrıntılar loglanır.
      console.error("intercom ignored: no message body", JSON.stringify({ topic, item }));
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const result = await classifyWidgetMessage(message);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      const workspaceId = await getWorkspaceId();
      // Sprint 48q: aynı Intercom conversation/ticket (id) tekrar post edilmesin.
      const sourceRef = intercomSourceRef(item, topic);
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

      // Contact id varsa onu, yoksa conversation/ticket id'yi kimlik olarak kullan.
      const identity = intercomIdentity(item);
      const userId = toWidgetUserId(`intercom_${identity}`);
      const contact = item.contact;
      const contactName =
        typeof contact === "object" && contact !== null
          ? typeof (contact as Record<string, unknown>).name === "string"
            ? ((contact as Record<string, unknown>).name as string)
            : null
          : null;
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `intercom-${identity}@widget.feedl.local`,
          name: contactName,
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
