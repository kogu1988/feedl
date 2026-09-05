import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  fetchIntercomContact,
  intercomContactId,
  intercomIdentity,
  intercomItemText,
  intercomSourceRef,
  isIntercomConfigured,
  isIntercomTokenConfigured,
  parseIntercomPayload,
  verifyIntercomWebhook,
} from "@/lib/intercom";
import { posts, users } from "@/lib/db/schema";
import { resolveIntegrationByUrlToken } from "@/lib/integrations";
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
    // Per-workspace context (Sprint 63g): ?ws&t varsa workspace_integrations'tan çöz.
    const { searchParams } = req.nextUrl;
    const wsParam = searchParams.get("ws");
    const tokenParam = searchParams.get("t");
    let integrationAppId: string | null = null;
    let integrationSecret: string | null = null;
    let workspaceId: string | null = null;
    if (wsParam && tokenParam) {
      const resolved = await resolveIntegrationByUrlToken("intercom", wsParam, tokenParam);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: "Geçersiz Intercom webhook token." },
          { status: 403 },
        );
      }
      integrationAppId = resolved.apiKey;
      integrationSecret = resolved.webhookSecret;
      workspaceId = resolved.workspaceId;
    }

    if (!integrationAppId && !isIntercomConfigured()) {
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

    if (!verifyIntercomWebhook(body, rawBody, req.headers, integrationAppId, integrationSecret)) {
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
      const targetWorkspaceId = workspaceId ?? (await getWorkspaceId());
      // Sprint 48q: aynı Intercom conversation/ticket (id) tekrar post edilmesin.
      const sourceRef = intercomSourceRef(item, topic);
      if (sourceRef) {
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
      }

      // Contact id varsa onu, yoksa conversation/ticket id'yi kimlik olarak kullan.
      const identity = intercomIdentity(item);
      const userId = toWidgetUserId(`intercom_${identity}`);
      // Intercom'tan gerçek e-posta/telefon/kanıt çek (enrichment). Token
      // yoksa veya istek başarısızsa graceful: widget yedeği kalır.
      const contactId = intercomContactId(item);
      const contactInfo = isIntercomTokenConfigured() && contactId
        ? await fetchIntercomContact(contactId)
        : { email: null, name: null, phone: null };
      const email = contactInfo.email ?? `intercom-${identity}@widget.feedl.local`;
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email,
          name: contactInfo.name ?? null,
          phone: contactInfo.phone ?? null,
          role: "customer",
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email,
            ...(contactInfo.name ? { name: contactInfo.name } : {}),
            ...(contactInfo.phone ? { phone: contactInfo.phone } : {}),
            updatedAt: new Date(),
          },
        });

      const [created] = await getDb()
        .insert(posts)
        .values({
          workspaceId: targetWorkspaceId,
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
