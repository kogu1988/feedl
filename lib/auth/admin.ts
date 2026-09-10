import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getWorkspaceRole } from "@/lib/db/membership";

// Dashboard yetkisinin TEK kaynağı workspace_members'tır (ROL AYRIMI
// 2026-09-10). Roller:
//   owner/admin → "admin"  (tam yönetim; owner en yetkili kademe)
//   contributor  → "team"    (kısmi yönetim: ürün/fikir operasyonu)
//   member       → "customer" (yalnız public portal)
// Üyelik yoksa yetki YOKTUR.
//
// `users.role='admin'` artık feedl PLATFORM personeli işaretidir (kendi iç
// admin panelimiz için ayrılmıştır) ve workspace dashboard erişimi VERMEZ;
// bkz. `isPlatformAdmin`.

export type WorkspaceScope = "admin" | "team" | "customer" | null;

// Request-scoped memo (React.cache): aynı userId için aynı istek içinde
// getRole yalnız BİR kez DB okur (sayfa + alt bileşen/API aynı rolü sorarsa
// kopya sorgu önlenir). Kalan sorguları her istekte taze tutar (güvenlik).
const fetchRole = cache(async (userId: string): Promise<WorkspaceScope> => {
  const membershipRole = await getWorkspaceRole(userId);
  if (membershipRole === "owner" || membershipRole === "admin") {
    return "admin";
  }
  if (membershipRole === "contributor") {
    return "team";
  }
  if (membershipRole === "member") {
    return "customer";
  }
  return null;
});

export async function getRole(userId: string): Promise<WorkspaceScope> {
  return fetchRole(userId);
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

// Giriş yapmış ekip üyesi (owner/admin/contributor) için userId döner;
// değilse null. Dashboard'ın ürün-operasyon sayfaları bu kademeyi kullanır
// (kullanıcı onaylı yetki matrisi). member (son kullanıcı) → null.
export async function getTeamUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const role = await getRole(userId);
  return role === "admin" || role === "team" ? userId : null;
}

// Dashboard erişim kademesi: "admin" (tam) | "team" (kısmi) | null (yok).
// Sidebar bu kademeye göre admin-only öğeleri gizler.
export async function getDashboardScope(): Promise<"admin" | "team" | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const role = await getRole(userId);
  if (role === "admin" || role === "team") return role;
  return null;
}

// Admin-only sayfaya ekip üyesi (contributor) doğrudan URL ile girerse
// /dashboard'a, member/son kullanıcı ise /portal'a yönlendir (kullanıcı onaylı
// yetki matrisi — "takım üyesi ürün operasyonundan dışarı atılmaz, portalda
// kaybolmaz").
export async function getNonAdminRedirectTarget(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) return "/portal";
  const role = await getRole(userId);
  return role === "team" ? "/dashboard" : "/portal";
}

// PLATFORM personeli mi (feedl ekibi)? `users.role='admin'` işareti workspace
// yetkisinden AYRI tutulur: müşteri workspace'lerine erişim vermez, feedl'in
// kendi iç admin paneli için ayrılmıştır.
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === "admin";
}
