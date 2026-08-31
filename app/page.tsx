import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// "/" bir yönlendirme sayfasıdır: giriş yapmışsa role'e göre (tek kaynak:
// Neon users.role), yapmamışsa herkese açık portala yönlendirir.
export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/portal");
  }

  try {
    const [user] = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    redirect(user?.role === "admin" ? "/dashboard" : "/portal");
  } catch (err) {
    console.error(
      "Root page role lookup failed:",
      err instanceof Error ? err.message : err,
    );
    redirect("/portal");
  }
}
