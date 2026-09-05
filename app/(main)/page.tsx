import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  BarChart3Icon,
  BracesIcon,
  MessageSquareTextIcon,
  PaletteIcon,
  PlugIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DemoPostCard } from "@/components/custom/demo-post-card";
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
      // Sprint 63 (rev.): onboarding'e YALNIZCA SaaS-funnel signup butonlarının
      // redirectUrl'u ile gidilir (landing/demo "Ücretsiz Başla"). Burada `/`
      // kuralı admin→dashboard / diğer→portal kalır — portal uç kullanıcısı
      // (müşterinin müşterisi) onboarding'e hiç gönderilmez.
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

  const features = [
    {
      title: "AI Autopilot",
      description:
        "Her fikir otomatik özetlenir, etiketlenir ve benzer isteklerle eşleştirilir. Kopyalarla uğraşmazsın.",
      icon: SparklesIcon,
    },
    {
      title: "Oylama & Yol Haritası",
      description:
        "Müşteriler oy verir, en çok istenen öne çıkar. Planlanan / geliştirilen / yayınlanan şeffaf bir yol haritası oluştur.",
      icon: RouteIcon,
    },
    {
      title: "Değişiklik Günlüğü",
      description:
        "Yayına aldığında oy verenlere otomatik e-posta gider; güncellemeler herkese açık bir günlüğe düşer.",
      icon: MessageSquareTextIcon,
    },
    {
      title: "Ekip & Rol Yönetimi",
      description:
        "Sahip, admin, katkıcı rolleriyle ekibin doğru kişiyi doğru işe yönlendirir; iç notlar gizli kalır.",
      icon: UsersIcon,
    },
    {
      title: "Entegrasyonlar",
      description:
        "Slack, Zendesk ve Intercom üzerinden gelen destek konuşmaları otomatik olarak fikre dönüşür.",
      icon: PlugIcon,
    },
    {
      title: "Public API & Webhook",
      description:
        "Fikirleri oku ve dışa aktar; olaylara webhook ile abone ol, iş akışlarına bağla.",
      icon: BracesIcon,
    },
    {
      title: "Marka & Alan Adı",
      description:
        "Kendi logon, rengin ve alan adınla herkese açık bir topluluk portalı kur.",
      icon: PaletteIcon,
    },
    {
      title: "Gelir Skoru",
      description:
        "Oy, müşteri ve fırsat değerini birleştirerek hangi özelliğin en çok getireceğini önceliklendir.",
      icon: BarChart3Icon,
    },
    {
      title: "Güvenlik & Gizlilik",
      description:
        "Rol bazlı erişim, anahtar ile doğrulanmış API ve iç notların müşteriye sızmaması.",
      icon: ShieldCheckIcon,
    },
    {
      title: "İş Akışı & Görünümler",
      description:
        "Kayıtlı filtreler, toplu aksiyonlar ve sunucu tarafı sayfalama ile kalabalık panoları yönet.",
      icon: WorkflowIcon,
    },
  ];

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <h1 className="hero-rise max-w-xl text-4xl font-bold sm:text-5xl lg:text-6xl">
            Müşteri isteklerini tahminle değil, veriyle önceliklendir.
          </h1>
          <p
            className="hero-rise mt-4 max-w-xl text-lg text-muted-foreground"
            style={{ animationDelay: "60ms" }}
          >
            Fikirleri toplamak, oylamak ve AI ile analiz etmek için tek
            platform. Canny&apos;ye ücretsiz bir alternatif — ürününü müşteri
            sesiyle şekillendir.
          </p>
          <div
            className="hero-rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "120ms" }}
          >
            <SignUpButton forceRedirectUrl="/onboarding">
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

        <div aria-hidden="true" className="hero-rise" style={{ animationDelay: "180ms" }}>
          <DemoPostCard
            title="Karanlık mod desteği"
            date="31 Ağustos 2026"
            status="shipped"
            type="feature"
            sentiment="pozitif"
            tags={["karanlıkmod", "tema"]}
            description="Gözleri çok yoran açık temaya alternatif olarak karanlık mod istiyoruz. Ayarlardan açılıp kapatılabilse iyi olur."
            voteCount={128}
            commentCount={32}
          />
        </div>
      </section>

      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Nasıl çalışır</h2>
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

      <section className="mt-20 sm:mt-24">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight">
            Geri bildirimden ürün kararına her şey
          </h2>
          <p className="mt-3 text-muted-foreground">
            Toplama, analiz, önceliklendirme ve duyuruyu tek bir platformda
            birleştir. Müşterin ne ister, ekibin ne geliştirir — hepsi şeffaf.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border bg-card p-5"
            >
              <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                <feature.icon className="size-5 text-brand" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-2xl border bg-brand-soft p-8 text-center sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">
          Bugün ücretsiz başla
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Kredi kartı gerekmez. 1 board, 1 üye ve 50 takipçi ile hemen toplamaya
          başla.
        </p>
        <div className="mt-6 flex justify-center">
          <SignUpButton forceRedirectUrl="/onboarding">
            <Button size="lg">Ücretsiz Başla</Button>
          </SignUpButton>
        </div>
      </section>
    </main>
  );
}
