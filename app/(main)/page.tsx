import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { MessageSquareTextIcon, RocketIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// "/" iki rol oynar (plan.md Sprint 9): giriş yapmışsa role'e göre (tek
// kaynak: Neon users.role) dashboard/portala yönlendirir; ziyaretçiye
// landing page gösterir.
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    // redirect() NEXT_REDIRECT hatası fırlatır; try içinde çağrılırsa
    // catch bunu yakalayıp yanlış sayfaya yönlendirir. Bu yüzden hedef
    // önce belirlenir, redirect try bloğunun DIŞINDA çağrılır.
    let target = "/portal";
    try {
      const [user] = await getDb()
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user?.role === "admin") {
        target = "/dashboard";
      }
    } catch (err) {
      console.error(
        "Root page role lookup failed:",
        err instanceof Error ? err.message : err,
      );
    }
    redirect(target);
  }

  const features = [
    {
      icon: MessageSquareTextIcon,
      title: "Topla ve öne çıkar",
      description:
        "Müşteriler fikrini paylaşır, başkalarının fikrine oy verir. En çok istenen özellik kendiliğinden üst sıraya çıkar.",
    },
    {
      icon: SparklesIcon,
      title: "AI Autopilot",
      description:
        "Her yeni fikir otomatik olarak özetlenir ve etiketlenir; benzer istekler kopya olarak işaretlenir, ekip zaman kaybetmez.",
    },
    {
      icon: RocketIcon,
      title: "Şeffaf yol haritası",
      description:
        "Planlandı → Geliştiriliyor → Yayında akışını herkese açık kanbanda göster; bir özellik yayınlandığında oy verenlere e-posta gider.",
    },
  ];

  return (
    <main className="container mx-auto max-w-5xl px-4 pb-20 pt-16 sm:pt-24">
      <section className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          AI destekli müşteri geri bildirim platformu
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Müşterinin sesini ürün yol haritasına dönüştür
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Fikirleri tek yerde topla, oylamaya aç, AI ile analiz et. Hangi
          özelliği geliştireceğine artık tahmin yürüterek değil, veriyle karar
          ver.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SignUpButton>
            <Button size="lg">Fikir vermeye başla</Button>
          </SignUpButton>
          <Button size="lg" variant="outline" render={<Link href="/portal" />}>
            Fikirlere göz at
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon
                className="size-5 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent className="hidden" />
          </Card>
        ))}
      </section>
    </main>
  );
}
