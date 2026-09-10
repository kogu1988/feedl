import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, workspaceMembers } from "@/lib/db/schema";

// Clerk -> Neon users tablosu senkronizasyonu.
// Clerk Dashboard > Webhooks > Endpoint: /api/webhooks/clerk
// Signing secret: CLERK_WEBHOOK_SIGNING_SECRET (whsec_...)
export async function POST(req: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return Response.json(
      { success: false, error: "Webhook signing secret is not configured" },
      { status: 500 },
    );
  }

  const wh = new Webhook(signingSecret);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const hdrs = await headers();
  const svixId = hdrs.get("svix-id");
  const svixTimestamp = hdrs.get("svix-timestamp");
  const svixSignature = hdrs.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json(
      { success: false, error: "Missing svix headers" },
      { status: 400 },
    );
  }

  let evt: WebhookEvent;
  try {
    // svix verify() imzayı doğrular, geçersizse throw eder (değer döndürmez).
    wh.verify(JSON.stringify(payload), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    evt = payload as WebhookEvent;
  } catch (err) {
    console.error(
      "Clerk webhook verification failed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { success: false, error: "Invalid signature" },
      { status: 400 },
    );
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const primary =
          email_addresses.find(
            (e) => e.id === evt.data.primary_email_address_id,
          ) ?? email_addresses[0];
        const primaryEmail = primary?.email_address;

        if (!primaryEmail) {
          return Response.json(
            { success: false, error: "User has no email address" },
            { status: 400 },
          );
        }

        const name = [first_name, last_name].filter(Boolean).join(" ") || null;

        // user.updated'ta role ezilmez; rol tek kaynak olarak DB'de kalır.
        await getDb()
          .insert(users)
          .values({ id, email: primaryEmail, name, role: "customer" })
          .onConflictDoUpdate({
            target: users.id,
            set: { email: primaryEmail, name, updatedAt: new Date() },
          });

        // Aynı kişi yeni bir Clerk kimliğiyle dönebilir (yeniden kayıt ya da
        // farklı giriş sağlayıcı) → yeni satır "customer" açılır ve kişi sahibi
        // olduğu workspace'in dashboard erişimini kaybederdi. Bu durumda, aynı
        // DOĞRULANMIŞ e-postayla kayıtlı bir admin varsa rolü ve workspace
        // üyeliklerini devral.
        //
        // Yalnız `verification.status === "verified"` iken: aksi halde
        // başkasının adresini yazan biri yetki devralabilirdi (Clerk adresi
        // zaten doğrulanmış olarak işaretlemeden bu desene izin verme).
        const verification = (
          primary as { verification?: { status?: string } | null } | undefined
        )?.verification;
        if (evt.type === "user.created" && verification?.status === "verified") {
          const [sibling] = await getDb()
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                ne(users.id, id),
                sql`lower(${users.email}) = ${primaryEmail.toLowerCase()}`,
                eq(users.role, "admin"),
              ),
            )
            .limit(1);

          if (sibling) {
            await getDb()
              .update(users)
              .set({ role: "admin", updatedAt: new Date() })
              .where(eq(users.id, id));

            const memberships = await getDb()
              .select({
                workspaceId: workspaceMembers.workspaceId,
                role: workspaceMembers.role,
              })
              .from(workspaceMembers)
              .where(eq(workspaceMembers.userId, sibling.id));

            if (memberships.length > 0) {
              await getDb()
                .insert(workspaceMembers)
                .values(
                  memberships.map((m) => ({
                    workspaceId: m.workspaceId,
                    userId: id,
                    role: m.role,
                  })),
                )
                .onConflictDoNothing();
            }
          }
        }
        break;
      }
      case "user.deleted": {
        const { id } = evt.data;
        if (id) {
          await getDb().delete(users).where(eq(users.id, id));
        }
        break;
      }
      default:
        // İlgilenmediğimiz event'ler sessizce onaylanır.
        break;
    }
  } catch (err) {
    console.error(
      "Clerk webhook handler error:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { success: false, error: "Internal error" },
      { status: 500 },
    );
  }

  return Response.json({ success: true, data: { received: evt.type } });
}
