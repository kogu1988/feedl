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
  // Sprint 63+ (yetki matrisi): sidebar, kullanıcının dashboard kademesine
  // göre admin-only öğeleri gizler (contributor → "team").
  const scope = await getDashboardScope();
  return (
    <div className="flex w-full flex-col md:flex-row">
      <AppSidebar scope={scope} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
