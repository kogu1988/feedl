import "server-only";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { changelogEntries } from "@/lib/db/schema";
import { changelogPublishedEventSchema } from "@/lib/validations/events";
import { inngest } from "@/inngest/client";

// Sprint 48n — draft changelog'u yayınla. publishedAt set edilir ve
// changelog/published event'i (abonelere mail) gönderilir.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz duyuru kimliği." },
        { status: 400 },
      );
    }
    const workspaceId = await getWorkspaceId();
    const [entry] = await getDb()
      .select({ title: changelogEntries.title })
      .from(changelogEntries)
      .where(
        and(eq(changelogEntries.id, id), eq(changelogEntries.workspaceId, workspaceId)),
      )
      .limit(1);
    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Duyuru bulunamadı." },
        { status: 404 },
      );
    }
    const [bodyRow] = await getDb()
      .select({ body: changelogEntries.body })
      .from(changelogEntries)
      .where(eq(changelogEntries.id, id))
      .limit(1);

    const [updated] = await getDb()
      .update(changelogEntries)
      .set({ status: "published", publishedAt: new Date() })
      .where(
        and(eq(changelogEntries.id, id), eq(changelogEntries.workspaceId, workspaceId)),
      )
      .returning({ id: changelogEntries.id });

    const event = changelogPublishedEventSchema.safeParse({
      entryId: id,
      title: entry.title,
      body: bodyRow?.body ?? "",
    });
    if (event.success) {
      try {
        await inngest.send({ name: "changelog/published", data: event.data });
      } catch (eventErr) {
        console.error("changelog publish event send failed:", eventErr);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("POST /api/admin/changelog/[id]/publish failed:", err);
    return NextResponse.json(
      { success: false, error: "Duyuru yayınlanamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
