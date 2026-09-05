import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import { isZendeskConfigured, verifyZendeskToken, zendeskAuthFromHeaders, zendeskTicketText, type ZendeskTicket } from "@/lib/zendesk";
import { posts, users } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 48p — Zendesk webhook. Trigger → webhook (target) ticket.created →
// AI triage → feedback oluştur. Doğrulama custom header token (kurumsal:
// uygulama feedl olarak adlandırılır).
export async function POST(req: NextRequest) {
  try {
    if (!isZendeskConfigured()) {
      return NextResponse.json(
        { success: false, error: "Zendesk yapılandırılmamış (ZENDESK_WEBHOOK_SECRET yok)." },
        { status: 503 },
      );
    }
    const auth = zendeskAuthFromHeaders(req.headers);
    if (!verifyZendeskToken(auth)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Zendesk token." },
        { status: 401 },
      );
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Geçersiz JSON." },
        { status: 400 },
      );
    }
    // Ticket kaynağı: Zendesk events `event.data.ticket`, trigger `ticket`.
    const p = payload as { ticket?: ZendeskTicket; event?: { data?: { ticket?: ZendeskTicket } } };
    const ticket = p.ticket ?? p.event?.data?.ticket;
    if (!ticket) {
      // Zendesk test/istenmeyen — sessizce 200.
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const { title, body } = zendeskTicketText(ticket);
    if (!body) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const result = await classifyWidgetMessage(body);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      const workspaceId = await getWorkspaceId();
      // Sprint 48q: aynı Zendesk ticket'ı (id) tekrar post edilmesin.
      const sourceRef = ticket.id ? `zendesk:${ticket.id}` : null;
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
      const userId = toWidgetUserId(`zendesk_${ticket.id ?? "ticket"}`);
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `zendesk-${ticket.id ?? "ticket"}@widget.feedl.local`,
          name: null,
          role: "customer",
        })
        .onConflictDoUpdate({ target: users.id, set: { updatedAt: new Date() } });

      const [created] = await getDb()
        .insert(posts)
        .values({
          workspaceId,
          boardId: await getDefaultBoardId(),
          userId,
          title,
          description: body,
          source: "zendesk",
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
            description: body,
            userId,
          }),
        });
      } catch (eventErr) {
        console.error("zendesk post/created send failed:", eventErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, postId: createdPostId },
    });
  } catch (err) {
    console.error("POST /api/integrations/zendesk/webhook failed:", err);
    return NextResponse.json(
      { success: false, error: "Zendesk event işlenemedi." },
      { status: 500 },
    );
  }
}
