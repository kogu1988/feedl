import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { WorkspaceSettings } from "@/components/custom/workspace-settings";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48a (madde 8) — workspace yönetim paneli. Ad, slug (salt-okunur
// subdomain önizleme), custom domain, marka rengi ve logo.
export default async function SettingsPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  let initial: Awaited<ReturnType<typeof loadWorkspace>> | null = null;
  let loadError = false;
  try {
    initial = await loadWorkspace();
  } catch (err) {
    console.error(
      "SettingsPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Workspace Ayarları</h1>
        <p className="mt-2 text-muted-foreground">
          Alan adı ve marka bilgilerini yönet. Subdomain, workspace bazlı
          portallar için kaynaktır.
        </p>
      </div>

      {loadError || !initial ? (
        <p className="mt-6 text-sm text-destructive">
          Workspace yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <WorkspaceSettings initial={initial} />
      )}
    </main>
  );
}

async function loadWorkspace() {
  const [row] = await getDb()
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      customDomain: workspaces.customDomain,
      brandColor: workspaces.brandColor,
      logoUrl: workspaces.logoUrl,
    })
    .from(workspaces)
    .where(eq(workspaces.id, await getWorkspaceId()))
    .limit(1);
  if (!row) {
    throw new Error("Workspace bulunamadı.");
  }
  return row;
}
