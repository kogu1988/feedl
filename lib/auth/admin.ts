import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getWorkspaceRole } from "@/lib/db/membership";

// Rolun tek kaynağı DB'deki users.role (standarts.md; middleware sadece
// giriş kontrolü yapar). Sprint 48c-2: workspace_members katmanı eklendi —
// getRole önce workspace rolünü (owner/admin → "admin", member →
// "customer") döner; membership yoksa global users.role'a düşer (geçiş
// dönemi uyumluluğu). Sayfa ve API'ler bu yardımcıyla admin'i doğrular.
//
// Sprint 63+ (yetki matrisi — kullanıcı onayı): üç kademe —
//   owner/admin → "admin"  (tam yönetim)
//   contributor  → "team"    (kısmi yönetim: ürün/fikir operasyonu)
//   member       → "customer" (yalnız public portal)
// "admin" içeren kontroller (`=== "admin"`) contributor'da yine false
// döner — portal iç-not görünürlüğü ve kritik admin API'leri etkilenmez.

export type WorkspaceScope = "admin" | "team" | "customer" | null;

export async function getRole(userId: string): Promise<WorkspaceScope> {
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
  // Geçiş dönemi: workspace_members'da yoksa global users.role (admin). Bu,
  // eski admin hesaplarının hâlâ çalışmasını sağlar.
  const [row] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row?.role === "admin") return "admin";
  return row?.role === "customer" ? "customer" : null;
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
