import { auth } from "@clerk/nextjs/server";

import { AppSidebar } from "@/components/custom/app-sidebar";
import { getDashboardScope } from "@/lib/auth/admin";

// Sprint 51 (Batch 2): admin kabuk — yalnız /dashboard altında solda
// daralabilir slate sidebar; public yüzeyler (portal, yol haritası,
// changelog) üst bar düzeninde kalır (DESIGN.md §4 hibrit kabuk).
// Not: sayfa kökleri kendi <main> etiketini verdiği için burada div
// kullanılır (nested main olmasın).
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 2026-09-12 (kod incelemesi #7, SAVUNMA DERİNLİĞİ): /dashboard koruması
  // şimdiye kadar YALNIZCA middleware'deki createRouteMatcher'a bağlıydı ve o
  // API deprecated: "Middleware-based auth checks rely on path matching, which
  // can diverge from how Next.js routes requests and leave protected resources
  // reachable." Bu tam da bu repoda üç kez bug üreten sınıf (paddle,
  // visual-feedback, unsubscribe). Yetkiyi kaynak seviyesinde de doğrula:
  // oturum yoksa sign-in'e yönlenir, böylece matcher bir gün yanlış
  // yapılandırılsa/çıkarılsa bile dashboard açıkta kalmaz.
  await auth.protect();

  // Sprint 63+ (yetki matrisi): sidebar, kullanıcının dashboard kademesine
  // göre admin-only/owner-only öğeleri gizler (member → "team").
  const scope = await getDashboardScope();
  return (
    <div className="flex w-full flex-col md:flex-row">
      <AppSidebar scope={scope} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
