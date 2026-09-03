import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronUpIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
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

  // Sprint 36: ortalanmış hero + 3 özdeş kart yerine asimetrik hero —
  // solda vaat, sağda ürünün kendisi (gerçek bir portal fikir kartı ve
  // Autopilot çıktısı). Kart dizisi yerine gerçek bir sıra olan iş akışı
  // şeridi geldi (Topla → Anla → Duyur).
  const steps = [
    {
      title: "Topla",
      description:
        "Müşteriler fikrini paylaşır, başkaları oy verir. En çok istenen özellik kendiliğinden üst sıraya çıkar.",
    },
    {
      title: "Anla",
      description:
        "Autopilot her fikri özetler, etiketler ve benzer istekleri işaretler; karar verirken kopyalarla uğraşmazsın.",
    },
    {
      title: "Duyur",
      description:
        "Yayına aldığında oy veren herkese e-posta gider, herkese açık yol haritası güncel kalır.",
    },
  ];

  return (
    <main className="container mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pt-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <h1 className="max-w-lg text-4xl font-bold sm:text-5xl">
            Müşterinin sesini ürün yol haritasına dönüştür
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Fikirleri tek yerde topla, oylamaya aç, AI ile analiz et. Hangi
            özelliği geliştireceğine artık tahmin yürüterek değil, veriyle
            karar ver.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignUpButton>
              <Button size="lg">Fikir vermeye başla</Button>
            </SignUpButton>
            <Button size="lg" variant="outline" render={<Link href="/portal" />}>
              Fikirlere göz at
            </Button>
          </div>
        </div>

        <div aria-hidden="true">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base leading-snug">
                  Karanlık mod desteği
                </CardTitle>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-semibold tabular-nums">
                  <ChevronUpIcon
                    className="size-3.5 text-brand"
                    aria-hidden="true"
                  />
                  128
                </span>
              </div>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <StatusBadge status="shipped" />
                <span>32 yorum</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="hidden" />
          </Card>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2.5">
            <SparklesIcon
              className="size-3.5 shrink-0 text-brand"
              aria-hidden="true"
            />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Autopilot:</span>{" "}
              benzer 3 fikir tek başlıkta birleştirildi, şöyle özetlendi —
              &quot;Mobil ve webde koyu tema isteniyor.&quot;
            </p>
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-24">
        <h2 className="text-xl font-semibold">Nasıl çalışır</h2>
        <ol className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="sm:pr-6">
              <span className="flex size-6 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
              <p className="mt-3 font-medium">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
