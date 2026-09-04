import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Sprint 43 (PM raporu §9 full API/webhook event matrix) — public API'den
// (POST /api/v1/posts) gelen geri bildirimleri veri sahibinin kullanıcısına
// bağlar. feedl'in users tablosu Clerk kullanıcılarına bağlıdır; API yolu
// için `api_` önekli stabil bir id üretilir, e-posta ile bul-un-tak hedefi
// idempotenttir. Clerk rolüne dokunmaz (customer rolü varsayılır).

export interface ApiUserIdentity {
  id: string;
  email: string;
  name?: string | null;
}

export async function upsertApiUser(
  email: string,
  name?: string | null,
): Promise<ApiUserIdentity> {
  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    // İsim yoksa doldur (best-effort), e-posta zaten eşleşti.
    if (!existing.name && name) {
      await getDb()
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    return { id: existing.id, email: existing.email, name: existing.name ?? name };
  }

  const id = `api_${randomUUID()}`;
  const [created] = await getDb()
    .insert(users)
    .values({ id, email: normalizedEmail, name: name?.trim() || null })
    .returning({ id: users.id, email: users.email, name: users.name });

  return { id: created.id, email: created.email, name: created.name };
}
