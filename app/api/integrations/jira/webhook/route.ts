import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDefaultBoardId } from "@/lib/db/board";
import { classifyWidgetMessage } from "@/lib/ai/analysis";
import {
  isJiraConfigured,
  jiraIdentity,
  jiraTicketText,
  parseJiraPayload,
  verifyJiraSignature,
} from "@/lib/jira";
import { posts, users } from "@/lib/db/schema";
import { toWidgetUserId } from "@/lib/widget/jwt";
import { postCreatedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 57 (madde 2) — Jira webhook. Automation/Webhook → Issue
// created/updated → AI triage → feedback oluştur. Doğrulama custom header
// JIRA_WEBHOOK_SECRET (Linear gibi HMAC-SHA256). Idempotency: aynı ticket tekrar
// post edilmez.
export async function POST(req: NextRequest) {
  try {
    if (!isJiraConfigured()) {
      return NextResponse.json(
        { success: false, error: "Jira yapılandırılmamış (JIRA_WEBHOOK_SECRET yok)." },
        { status: 503 },
      );
    }

    const rawBody = await req.text();
    const auth = req.headers.get("x-jira-signature") ?? req.headers.get("x-feedl-token") ?? "";
    if (!verifyJiraSignature(rawBody, auth)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Jira imzası." },
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
    const { eventType, ticket } = parseJiraPayload(payload as Record<string, unknown>);
    if (!ticket) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const { title, body: message } = jiraTicketText(ticket);
    if (!message) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }

    const result = await classifyWidgetMessage(message);
    const classification = result.classification;

    let createdPostId: string | null = null;
    if (classification === "feedback") {
      const workspaceId = await getWorkspaceId();
      // Sprint 48q: aynı Jira ticket (id/key) tekrar post edilmesin.
      const sourceRef = ticket.id ? `jira:${ticket.id}` : ticket.key ? `jira:${ticket.key}` : null;
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

      const identity = jiraIdentity(ticket);
      const userId = toWidgetUserId(`jira_${identity}`);
      await getDb()
        .insert(users)
        .values({
          id: userId,
          email: `jira-${identity}@widget.feedl.local`,
          name: ticket.fields?.creator?.displayName ?? null,
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
          source: "jira",
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
        console.error("jira post/created send failed:", eventErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, postId: createdPostId },
    });
  } catch (err) {
    console.error("POST /api/integrations/jira/webhook failed:", err);
    return NextResponse.json(
      { success: false, error: "Jira event işlenemedi." },
      { status: 500 },
    );
  }
}
