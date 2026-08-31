import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let isAdmin = false;
  try {
    const [user] = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    isAdmin = user?.role === "admin";
  } catch (err) {
    console.error(
      "Dashboard role lookup failed:",
      err instanceof Error ? err.message : err,
    );
  }

  if (!isAdmin) redirect("/portal");

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Admin Paneli</h1>
      <p className="mt-2 text-muted-foreground">
        Fikir tablosu ve durum yönetimi Sprint 4&apos;te eklenecek.
      </p>
    </main>
  );
}
