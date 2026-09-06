import { redirect } from "next/navigation";

import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

// Sprint 63k (kullanıcı): Workspace Ayarları → /dashboard/workspaces,
// Entegrasyonlar → /dashboard/integrations. Boşalan bu sayfa eski URL'ler için
// workspaces'e yönlendirir (ölü 404 olmasın).
export default async function SettingsPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect(await getNonAdminRedirectTarget());
  }
  redirect("/dashboard/workspaces");
}
