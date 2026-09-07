import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  BarChart3Icon,
  BracesIcon,
  InboxIcon,
  MegaphoneIcon,
  MessageSquareTextIcon,
  PaletteIcon,
  PlugIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { getRole } from "@/lib/auth/admin";
import { isShowcaseRequest } from "@/lib/db/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IdeaCard } from "@/components/custom/idea-card";
import { StatusBadge } from "@/components/custom/status-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { PricingManager } from "@/components/custom/pricing-manager";

// Sprint 50 (Faz 4/cilama) — "/" artık SATIŞ landing'idir. Portal / yol
// haritası / güncellemeler nav'dan çıkarıldı; ürün örnekleri /demo'ya taşındı.
// Hedef: feedl'i (SaaS) satın alacak şirket temsilcisi. Portal yüzeyleri son
// kullanıcıya ait olduğundan "fikir verme / göz at" çağrıları yerine
// "Ücretsiz Başla", "Canlı Demo", "Fiyatlandırma" CTA'ları var.
// Giriş yapmışsa role'e göre dashboard/portal yönlendirmesi. Rolün tek kaynağı
// Neon (Sprint 48c-2): önce workspace_members (owner/admin → admin) sonra
// users.role fallback. `getRole` kullanılır — ham users.role sütunu, owner'ı
// workspace'te yaşayan (Clerk webhook'undan gelen) hesaplarda yanlış → portal'a
// düşürürdü (kullanıcı bildirdi: "admin giriş yaptı ama portal'a yönlendim").
// Sprint 63 (rev.): onboarding'e YALNIZCA SaaS-funnel signup butonlarının
// redirectUrl'u ile gidilir; burada admin→dashboard / diğer→portal kalır —
// portal uç kullanıcısı onboarding'e hiç gönderilmez.
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    let target = "/portal";
    try {
      const role = await getRole(userId);
      if (role === "admin" || role === "team") {
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

  // Sprint 63q — custom domain / müşteri subdomain'inde "/" SaaS satış
  // sayfası değil, MÜŞTERİNİN PORTALI olmalı. feedl kök host'u (feedl.app /
  // www / APP_URL) vitrin sayfasıdır; diğer host'lar (feedback.acme.com,
  // acme.feedl.app) gerçek müşteri portalıdır → "/portal"a yönlendir.
  if (!(await isShowcaseRequest())) {
    redirect("/portal");
  }

  const steps = [
    {
      title: "Topla",
      description:
        "Müşterilerin istekleri tek bir panoya düşer; oylar en çok istenen özelliği üste taşır.",
      icon: InboxIcon,
      accent: "bg-brand-soft text-brand",
    },
    {
      title: "Anla",
      description:
        "Autopilot her fikri özetler, etiketler ve benzer istekleri işaretler; tahminle değil veriyle karar verirsin.",
      icon: SparklesIcon,
      accent: "bg-brand-soft text-brand",
    },
    {
      title: "Duyur",
      description:
        "Yayına aldığında oy veren herkese e-posta gider; şeffaf yol haritası ve değişiklik günlüğü güncel kalır.",
      icon: MegaphoneIcon,
      accent: "bg-brand-soft text-brand",
    },
  ];

  // Sprint 63r: Free özellikler önce, Pro özellikler sonra (net hiyerarşi).
  const features = [
    {
      title: "AI Autopilot",
      description:
        "Her fikir otomatik özetlenir, etiketlenir ve benzer isteklerle eşleştirilir. Kopyalarla uğraşmazsın.",
      icon: SparklesIcon,
      plan: "free",
    },
    {
      title: "Oylama & Yol Haritası",
      description:
        "Müşteriler oy verir, en çok istenen öne çıkar. Planlanan / geliştirilen / yayınlanan şeffaf bir yol haritası oluştur.",
      icon: RouteIcon,
      plan: "free",
    },
    {
      title: "Değişiklik Günlüğü",
      description:
        "Yayına aldığında oy verenlere otomatik e-posta gider; güncellemeler herkese açık bir günlüğe düşer.",
      icon: MessageSquareTextIcon,
      plan: "free",
    },
    {
      title: "Ekip & Rol Yönetimi",
      description:
        "Sahip, admin, katkıcı rolleriyle ekibin doğru kişiyi doğru işe yönlendirir; iç notlar gizli kalır.",
      icon: UsersIcon,
      plan: "free",
    },
    {
      title: "Güvenlik & Gizlilik",
      description:
        "Rol bazlı erişim, anahtar ile doğrulanmış API ve iç notların müşteriye sızmaması.",
      icon: ShieldCheckIcon,
      plan: "free",
    },
    {
      title: "Entegrasyonlar",
      description:
        "Slack, Zendesk, Intercom, Jira ve Linear üzerinden gelen destek konuşmaları otomatik olarak fikre dönüşür.",
      icon: PlugIcon,
      plan: "pro",
    },
    {
      title: "AI İçgörüleri",
      description:
        "Tüm geri bildirim korpusunu analiz eder — temalar, trendler, riskler ve hızlı kazanımlar.",
      icon: TrendingUpIcon,
      plan: "pro",
    },
    {
      title: "Public API & Webhook",
      description:
        "Fikirleri oku ve dışa aktar; olaylara webhook ile abone ol, iş akışlarına bağla.",
      icon: BracesIcon,
      plan: "pro",
    },
    {
      title: "Marka & Alan Adı",
      description:
        "Kendi logon, rengin ve alan adınla herkese açık bir topluluk portalı kur; feedl rozetini kaldır.",
      icon: PaletteIcon,
      plan: "pro",
    },
    {
      title: "Gelir Skoru",
      description:
        "Oy, müşteri ve fırsat değerini birleştirerek hangi özelliğin en çok getireceğini önceliklendir.",
      icon: BarChart3Icon,
      plan: "pro",
    },
    {
      title: "İş Akışı & Görünümler",
      description:
        "Kayıtlı filtreler, toplu aksiyonlar ve sunucu tarafı sayfalama ile kalabalık panoları yönet.",
      icon: WorkflowIcon,
      plan: "pro",
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
          {/* F5: mock kart — DemoPostCard yerine tek kaynak IdeaCard (link'siz, aria-hidden). */}
          <IdeaCard
            title="Karanlık mod desteği"
            ariaHidden
            badges={
              <>
                <StatusBadge status="shipped" />
                <TypeBadge type="feature" />
                <SentimentBadge sentiment="pozitif" />
              </>
            }
            date="31 Ağustos 2026"
            tags={
              <>
                <Badge className="border-border bg-muted text-muted-foreground">#karanlıkmod</Badge>
                <Badge className="border-border bg-muted text-muted-foreground">#tema</Badge>
              </>
            }
            description="Gözleri çok yoran açık temaya alternatif olarak karanlık mod istiyoruz. Ayarlardan açılıp kapatılabilse iyi olur."
            voteCount={128}
            commentCount={32}
            commentPostId="demo"
          />
        </div>
      </section>

      <section className="mt-20 sm:mt-24">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight">Nasıl çalışır</h2>
          <p className="mt-3 text-muted-foreground">
            Üç adımda müşteri sesini ürüne dönüştürürsün.
          </p>
        </div>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col rounded-2xl border bg-card p-6"
            >
              <span className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-lg border bg-muted/40 font-mono text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span
                className={`flex size-11 items-center justify-center rounded-xl ${step.accent}`}
              >
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-lg font-semibold">{step.title}</p>
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                  <feature.icon className="size-5 text-brand" aria-hidden="true" />
                </div>
                <Badge
                  className={
                    feature.plan === "pro"
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {feature.plan === "pro" ? "Pro" : "Free"}
                </Badge>
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 sm:mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Hangi plan sana uygun?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Küçük ekipte ücretsiz başla; büyüdükçe Pro&apos;ya geç. Her plan
            kullanıcı başına değil, ekip başına fiyatlandırılır.
          </p>
        </div>

        {/* Sprint 63r: tüm plan kartları TEK STANDART — /pricing ile aynı
            PricingManager (Free kartı + Pro kartı, Pro'da aylık/yıllık switch
            varsayılan yıllık). Landing feedl kök workspace'ini temsil eder. */}
        <div className="mt-10">
          <PricingManager workspaceSlug="feedl" />
        </div>

        <p className="mt-6 text-center text-muted-foreground">
          Karşılaştırma ve tüm detaylar için{" "}
          <Link href="/pricing" className="font-medium underline-offset-4 hover:underline">
            fiyatlandırma sayfasına
          </Link>
          {" "}göz at.
        </p>
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

      {/* Sprint 63y — dogfood: feedl widget'ı kendi landing'ine embed.
          feedl.app self-origin (her zaman izinli), feedl workspace'ine
          (seed slug) hedeflenir — canlıda widget JWT + iframe + oylama
          akışını gerçekten test etmek için. Satış landing'inde
          salt-okunur listeyi değil, tam etkileşimi açar (jetonsuz). */}
      <script
        src="https://feedl.app/widget.js"
        data-feedl-url="https://feedl.app"
        data-feedl-workspace="feedl"
        data-button-text="Geri bildirim"
        data-theme="auto"
        async
      />
    </main>
  );
}
