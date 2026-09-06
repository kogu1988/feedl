import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { WorkspacesManager } from "@/components/custom/workspaces-manager";
import { WorkspaceSettings } from "@/components/custom/workspace-settings";
import { getAdminUserId, getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { asc, count } from "drizzle-orm";
import { boards, workspaces, type Workspace } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48g + 63k — çoklu workspace yönetimi. Ana workspace admin'i tüm
// workspace'leri görür; her workspace kendi boards/posts/üyeleriyle izole.
// Sprint 63k (kullanıcı): "Workspace Ayarları" buraya taşındı (settings'ten);
// mevcut workspace'in ad/domain/marka ayarları üstte, workspace listesi altta.
export default async function WorkspacesPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect(await getNonAdminRedirectTarget());
  }

  let items: Awaited<ReturnType<typeof loadWorkspaces>> = [];
  let loadError = false;
  let workspaceInfo: Workspace | null = null;
  let wsLoadError = false;
  try {
    items = await loadWorkspaces();
  } catch (err) {
    console.error(
      "WorkspacesPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }
  try {
    const [row] = await getDb()
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, await getWorkspaceId()))
      .limit(1);
    workspaceInfo = row ?? null;
  } catch (err) {
    console.error(
      "WorkspaceSettings load failed:",
      err instanceof Error ? err.message : err,
    );
    wsLoadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace&apos;ler</h1>
        <p className="mt-2 text-muted-foreground">
          Mevcut workspace&apos;in yapılandırmasını düzenle ve tüm
          workspace&apos;lerin listesini gör. Her workspace kendi
          subdomain&apos;inde izole çalışır — örn. acme.feedl.app.
        </p>
      </div>

      {workspaceInfo ? (
        <div className="mt-8">
          <WorkspaceSettings initial={workspaceInfo} />
        </div>
      ) : wsLoadError ? (
        <p className="mt-6 text-sm text-destructive">
          Workspace ayarları yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : null}

      <div className="mt-10">
        {loadError ? (
          <p className="text-sm text-destructive">
            Workspace&apos;ler yüklenemedi. Lütfen sayfayı yenile.
          </p>
        ) : (
          <WorkspacesManager initial={items} />
        )}
      </div>
    </main>
  );
}

async function loadWorkspaces() {
  const rows = await getDb()
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      customDomain: workspaces.customDomain,
      createdAt: workspaces.createdAt,
      boardCount: count(boards.id),
    })
    .from(workspaces)
    .leftJoin(boards, eq(boards.workspaceId, workspaces.id))
    .groupBy(workspaces.id)
    .orderBy(asc(workspaces.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    customDomain: row.customDomain,
    createdAt: row.createdAt,
    boardCount: Number(row.boardCount),
  }));
}
