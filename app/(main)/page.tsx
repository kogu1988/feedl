import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Sprint 50 (Faz 4/cilama) — "/" artık SATIŞ landing'idir. Portal / yol
// haritası / güncellemeler nav'dan çıkarıldı; ürün örnekleri /demo'ya taşındı.
// Hedef: feedl'i (SaaS) satın alacak şirket temsilcisi. Portal yüzeyleri son
// kullanıcıya ait olduğundan "fikir verme / göz at" çağrıları yerine
// "Ücretsiz Başla", "Canlı Demo", "Fiyatlandırma" CTA'ları var.
// Giriş yapmışsa role'e göre (tek kaynak: Neon users.role) dashboard/portal
// yönlendirmesi KORUNUR (Sprint 9 davranışı).
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
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

  const steps = [
    {
      title: "Topla",
      description:
        "Müşterilerin istekleri tek bir panoya düşer; oylar en çok istenen özelliği üste taşır.",
    },
    {
      title: "Anla",
      description:
        "Autopilot her fikri özetler, etiketler ve benzer istekleri işaretler; tahminle değil veriyle karar verirsin.",
    },
    {
      title: "Duyur",
      description:
        "Yayına aldığında oy veren herkese e-posta gider; şeffaf yol haritası ve değişiklik günlüğü güncel kalır.",
    },
  ];

  return (
    <main className="container mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pt-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <h1 className="max-w-lg text-4xl font-bold sm:text-5xl">
            Müşteri isteklerini tahminle değil, veriyle önceliklendir.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Fikirleri toplamak, oylamak ve AI ile analiz etmek için tek
            platform. Canny&apos;ye ücretsiz bir alternatif — ürününü müşteri
            sesiyle şekillendir.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignUpButton>
              <Button size="lg">Ücretsiz Başla</Button>
            </SignUpButton>
            <Button size="lg" variant="outline" render={<Link href="/demo" />}>
              Canlı Demo
            </Button>
            <Button
              size="lg"
              variant="ghost"
              render={<Link href="/pricing" />}
            >
              Fiyatlandırma
            </Button>
          </div>
        </div>

        <div aria-hidden="true">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="leading-snug">
                  Karanlık mod desteği
                </CardTitle>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium">
                  ▲ 128
                </span>
              </div>
              <CardDescription className="flex flex-wrap items-center gap-2">
                31 Ağustos 2026
                <StatusBadge status="shipped" />
                <TypeBadge type="feature" />
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  💬 32 yorum
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <SentimentBadge sentiment="pozitif" />
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                  #karanlıkmod
                </span>
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                  #tema
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                Gözleri çok yoran açık temaya alternatif olarak karanlık mod
                istiyoruz. Ayarlardan açılıp kapatılabilse iyi olur.
              </p>
            </CardContent>
          </Card>
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

      <section className="mt-20 rounded-2xl border bg-card p-8 text-center sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">
          Bugün ücretsiz başla
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Kredi kartı gerekmez. 1 board, 1 üye ve 50 takipçi ile hemen toplamaya
          başla.
        </p>
        <div className="mt-6 flex justify-center">
          <SignUpButton>
            <Button size="lg">Ücretsiz Başla</Button>
          </SignUpButton>
        </div>
      </section>
    </main>
  );
}
