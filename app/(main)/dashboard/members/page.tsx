import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { MembersManager } from "@/components/custom/members-manager";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { listWorkspaceMembers } from "@/lib/db/membership";
import { users } from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 48c-2 (madde 8) — workspace üyeleri ve rol matrisi.
export default async function MembersPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  let members: Awaited<ReturnType<typeof listWorkspaceMembers>> = [];
  let userOptions: { id: string; label: string }[] = [];
  let loadError = false;
  try {
    const memberRows = await listWorkspaceMembers();
    members = memberRows;
    // Üye ekleme seçici için tüm kullanıcılar (Clerk webhook ile kayıtlı).
    const allUsers = await getDb()
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .orderBy(asc(users.email));
    userOptions = allUsers.map((user) => ({
      id: user.id,
      label: user.name ? `${user.name} (${user.email})` : user.email,
    }));
  } catch (err) {
    console.error(
      "MembersPage load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Üyeler</h1>
        <p className="mt-2 text-muted-foreground">
          Workspace üyelerini ve rollerini yönet.
        </p>
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">
          Üyeler yüklenemedi. Lütfen sayfayı yenile.
        </p>
      ) : (
        <MembersManager initial={members} userOptions={userOptions} />
      )}
    </main>
  );
}
