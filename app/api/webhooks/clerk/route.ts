import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

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
        const primaryEmail =
          email_addresses.find(
            (e) => e.id === evt.data.primary_email_address_id,
          )?.email_address ?? email_addresses[0]?.email_address;

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
