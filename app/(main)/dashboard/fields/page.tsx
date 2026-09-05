import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { CustomFieldsManager } from "@/components/custom/custom-fields-manager";
import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { customFields } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 42 (PM raporu §8.5) — özel alan tanımları. Fikirlere admin'in
// kendi tanımladığı alanlar (metin/seçim/sayı/tarih) eklenir.
export default async function FieldsPage() {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  let initialFields: Awaited<ReturnType<typeof loadFields>> = [];
  let loadError = false;

  try {
    initialFields = await loadFields();
  } catch (err) {
    console.error(
      "FieldsPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Özel Alanlar</h1>
        <p className="mt-2 text-muted-foreground">
          Fikirlere eklenecek kendi alanlarını tanımla. Herkese açık
          seçtiğin alanlar portalda görünür.
        </p>
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">
          Özel alanlar yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <CustomFieldsManager initialFields={initialFields} />
      )}
    </main>
  );
}

async function loadFields() {
  return getDb()
    .select()
    .from(customFields)
    .where(eq(customFields.workspaceId, await getWorkspaceId()))
    .orderBy(asc(customFields.displayOrder), asc(customFields.createdAt));
}
