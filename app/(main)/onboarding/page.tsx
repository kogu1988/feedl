import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users, workspaceMembers } from "@/lib/db/schema";
import { OnboardingWizard } from "@/components/custom/onboarding-wizard";

export const dynamic = "force-dynamic";

// Sprint 63 (onboarding wizard) — yeni kullanıcı için self-serve "ilk 5
// dakikada çalışıyor" akışı. Giriş yapmış kullanıcı henüz hiçbir workspace'e
// üye değilse wizard gösterir; üyelik varsa dashboard'a yönlendirir.
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [member] = await getDb()
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  // Üyeliği varsa onboarding gerekmez → dashboard'a git. (Admin default
  // feedl workspace'e zaten bağlıdır; yeni müşteri üyeliksiz gelir.)
  if (member) {
    redirect("/dashboard");
  }

  const [user] = await getDb()
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    <main className="container mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Feedl&apos;e hoş geldin 👋
        </h1>
        <p className="mt-2 text-muted-foreground">
          {user?.name ? `${user.name}, ` : ""}geri bildirimlerini toplamak için
          çalışma alanını oluştur. Birkaç dakika içinde portalın yayında olacak.
        </p>
      </div>

      <OnboardingWizard />
    </main>
  );
}
