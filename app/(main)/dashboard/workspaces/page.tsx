import { redirect } from "next/navigation";

import { WorkspacesManager } from "@/components/custom/workspaces-manager";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { asc, eq, count } from "drizzle-orm";
import { boards, workspaces } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48g (madde 8) — çoklu workspace yönetimi. Ana workspace admin'i
// tüm workspace'leri görür; her workspace kendi boards/posts/üyeleriyle izole.
export default async function WorkspacesPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  let items: Awaited<ReturnType<typeof loadWorkspaces>> = [];
  let loadError = false;
  try {
    items = await loadWorkspaces();
  } catch (err) {
    console.error(
      "WorkspacesPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Workspace&apos;ler</h1>
        <p className="mt-2 text-muted-foreground">
          Her workspace kendi subdomain&apos;inde izole çalışır — örn. acme.feedl.app.
        </p>
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">
          Workspace&apos;ler yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <WorkspacesManager initial={items} />
      )}
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
