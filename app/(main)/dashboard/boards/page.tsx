import { redirect } from "next/navigation";

import { BoardsManager } from "@/components/custom/boards-manager";
import { getAdminUserId } from "@/lib/auth/admin";
import { listBoards } from "@/lib/db/board";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48b (madde 8) — board yönetimi. Feedback koleksiyonları.
export default async function BoardsPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  let initial: Awaited<ReturnType<typeof listBoards>> = [];
  let loadError = false;
  try {
    initial = await listBoards();
  } catch (err) {
    console.error(
      "BoardsPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Board&apos;lar</h1>
        <p className="mt-2 text-muted-foreground">
          Feedback koleksiyonlarını yönet. Her board kendi portalına sahiptir.
        </p>
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">
          Board&apos;lar yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <BoardsManager initial={initial} />
      )}
    </main>
  );
}
