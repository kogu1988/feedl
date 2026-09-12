import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getWorkspaceRole } from "@/lib/db/membership";

// Dashboard yetkisinin TEK kaynağı workspace_members'tır (3 kademe, 2026-09-11):
//   owner   → "owner"    (her şey + billing + workspace silme + owner devri)
//   manager → "admin"    (ürün ops + üye yönetimi; billing hariç)
//   member  → "team"     (ürün ops; ayarlar/billing/gelir hariç)
// Üyelik yoksa yetki YOKTUR (portal son kullanıcısı).
//
// `users.role='admin'` feedl PLATFORM personeli işaretidir (kendi iç admin
// panelimiz için ayrılmıştır) ve workspace dashboard erişimi VERMEZ;
// bkz. `isPlatformAdmin`.

export type WorkspaceScope = "owner" | "admin" | "team" | "customer" | null;

// Moderasyon kademesi: owner + manager. `"admin"` ham dizesi MANAGER'ı temsil
// eder, owner'ı DEĞİL — bu yüzden sayfa/API'lerde `role === "admin"` yazmak en
// üst kademeyi (ürünü satın alan owner'ı) dışarıda bırakır. 2026-09-12'de bu
// sınıf bug 6 yerde bulundu: landing giriş yönlendirmesi (owner /dashboard
// yerine /portal'a düşüyordu), portal private-board görünürlüğü (owner kendi
// gizli board'unu göremiyordu), iç not yazma ve yorum moderasyonu. Ham
// karşılaştırma YERİNE bu predicate kullanılır.
export function isAdminScope(role: WorkspaceScope): boolean {
  return role === "owner" || role === "admin";
}

// Request-scoped memo (React.cache): aynı userId için aynı istek içinde
// getRole yalnız BİR kez DB okur (sayfa + alt bileşen/API aynı rolü sorarsa
// kopya sorgu önlenir). Kalan sorguları her istekte taze tutar (güvenlik).
const fetchRole = cache(async (userId: string): Promise<WorkspaceScope> => {
  const membershipRole = await getWorkspaceRole(userId);
  if (membershipRole === "owner") {
    return "owner";
  }
  if (membershipRole === "manager") {
    return "admin";
  }
  if (membershipRole === "member") {
    return "team";
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

// Giriş yapmış yönetici (owner/manager) için userId döner; değilse null.
// Üye yönetimi, gelir, entegrasyonlar, içgörüler bu kademeyi gerektirir.
export async function getAdminUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return isAdminScope(await getRole(userId)) ? userId : null;
}

// Yalnız workspace OWNER'ı için userId döner; değilse null. Faturalandırma ve
// workspace silme gibi geri dönüşü olmayan/mali işlemler bu kademeye kilitlidir
// ("owner = ürünü satın alan" kararı).
export async function getOwnerUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return (await getRole(userId)) === "owner" ? userId : null;
}

// Giriş yapmış ekip üyesi (owner/manager/member) için userId döner; değilse
// null. Dashboard'ın ürün-operasyon sayfaları bu kademeyi kullanır. Üyeliği
// olmayan portal kullanıcısı → null.
export async function getTeamUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const role = await getRole(userId);
  return role === "owner" || role === "admin" || role === "team" ? userId : null;
}

// Dashboard erişim kademesi: "owner" (en üst) | "admin" (manager) | "team"
// (member) | null (yok). Sidebar bu kademeye göre admin-only ve owner-only
// öğeleri gizler.
export async function getDashboardScope(): Promise<
  "owner" | "admin" | "team" | null
> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const role = await getRole(userId);
  if (role === "owner" || role === "admin" || role === "team") return role;
  return null;
}

// Admin-only sayfaya member ("team") doğrudan URL ile girerse /dashboard'a,
// üyeliği olmayan son kullanıcı ise /portal'a yönlendir (yetki matrisi —
// "takım üyesi ürün operasyonundan dışarı atılmaz, portalda kaybolmaz").
export async function getNonAdminRedirectTarget(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) return "/portal";
  const role = await getRole(userId);
  return isAdminScope(role) || role === "team" ? "/dashboard" : "/portal";
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
