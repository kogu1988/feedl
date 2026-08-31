import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Rolun tek kaynağı DB'deki users.role (standarts.md; middleware sadece
// giriş kontrolü yapar). Sayfa ve API'ler bu yardımcıyla admin'i doğrular.
export async function getRole(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role ?? null;
}

// Kullanıcının Clerk userId'si varsa döner, yoksa null.
export async function getSessionUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// Giriş yapmış admin için userId döner; değilse null.
export async function getAdminUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const role = await getRole(userId);
  return role === "admin" ? userId : null;
}
