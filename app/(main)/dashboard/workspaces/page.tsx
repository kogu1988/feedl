import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { WorkspacesManager } from "@/components/custom/workspaces-manager";
import { WorkspaceSettings } from "@/components/custom/workspace-settings";
import { WorkspaceDataPrivacy } from "@/components/custom/workspace-data-privacy";
import {
  getAdminUserId,
  getDashboardScope,
  getNonAdminRedirectTarget,
} from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { asc, count } from "drizzle-orm";
import { boards, workspaces, type Workspace } from "@/lib/db/schema";
import { planFromString } from "@/lib/paddle";

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
  // Veri indirme/silme yalnız owner'a açıktır (API de aynı kapıyı uygular).
  const isOwner = (await getDashboardScope()) === "owner";

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
          Workspace&apos;lerini gör ve yeni bir tane oluştur; mevcut
          workspace&apos;in yapılandırmasını aşağıda düzenle. Her workspace
          kendi subdomain&apos;inde izole çalışır — örn. acme.feedl.app.
        </p>
      </div>

      {/* 1) Liste + TEK "yeni workspace" girişi.
          2026-09-12 (kullanıcı): daha önce liste sayfanın EN SONUNDAYDI ve
          "yeni workspace" butonu oraya gömülüyordu; sayfanın üstündeki
          "Workspace adı" formu da yeni workspace ekliyormuş gibi görünüyordu.
          Artık nesne (workspace'ler) en üstte, ayarlar ondan sonra ve net bir
          başlıkla ayrılmış durumda. */}
      <div className="mt-8">
        {loadError ? (
          <p className="text-sm text-destructive">
            Workspace&apos;ler yüklenemedi. Lütfen sayfayı yenile.
          </p>
        ) : (
          <WorkspacesManager initial={items} />
        )}
      </div>

      {/* 2) Mevcut workspace'in ayarları — ekleme değil, DÜZENLEME. */}
      {workspaceInfo ? (
        <section className="mt-10" aria-labelledby="mevcut-workspace-basligi">
          <h2
            id="mevcut-workspace-basligi"
            className="text-lg font-semibold tracking-tight"
          >
            Mevcut workspace ayarları
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspaceInfo.name} (
            <code className="font-mono">{workspaceInfo.slug}</code>) workspace&apos;ini
            düzenle.
          </p>
          <div className="mt-4">
            <WorkspaceSettings
              initial={{
                ...workspaceInfo,
                // Şema varchar → union normalize (geçersizse signup varsayılanı).
                widgetSubmissionMode:
                  workspaceInfo.widgetSubmissionMode === "anonymous" ||
                  workspaceInfo.widgetSubmissionMode === "email" ||
                  workspaceInfo.widgetSubmissionMode === "signup"
                    ? workspaceInfo.widgetSubmissionMode
                    : "signup",
              }}
              isPro={planFromString(workspaceInfo.plan) === "pro"}
            />
          </div>
        </section>
      ) : wsLoadError ? (
        <p className="mt-6 text-sm text-destructive">
          Workspace ayarları yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : null}

      {/* 3) Veri ve gizlilik (owner-only işlemler). */}
      {workspaceInfo ? (
        <WorkspaceDataPrivacy slug={workspaceInfo.slug} isOwner={isOwner} />
      ) : null}
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
