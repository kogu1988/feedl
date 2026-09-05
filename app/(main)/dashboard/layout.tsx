import { AppSidebar } from "@/components/custom/app-sidebar";

// Sprint 51 (Batch 2): admin kabuk — yalnız /dashboard altında solda
// daralabilir slate sidebar; public yüzeyler (portal, yol haritası,
// changelog) üst bar düzeninde kalır (DESIGN.md §4 hibrit kabuk).
// Not: sayfa kökleri kendi <main> etiketini verdiği için burada div
// kullanılır (nested main olmasın).
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex w-full flex-col md:flex-row">
      <AppSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
