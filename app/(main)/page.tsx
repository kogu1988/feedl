import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  BarChart3Icon,
  BotIcon,
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
  UploadIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { getNonAdminRedirectTarget } from "@/lib/auth/admin";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeroDemoCard } from "@/components/custom/hero-demo-card";
import { PricingManager } from "@/components/custom/pricing-manager";
import { PLAN_POSITIONING, ACCOUNT_PRO_NOTE, TRIAL_VS_WITHDRAWAL_NOTE, priceCurrencyNote } from "@/lib/plan-copy";
import { generateCanonical, ogImage } from "@/lib/seo";

// Landing SEO — root layout'un title template'i + metadataBase'ine dayanır;
// burada landing'e özel description, OG/Twitter ve JSON-LD (SoftwareApplication)
// tanımlanır. Canonical (F2) korunur. Girişli kullanıcı `/` yerine yönlendiği
// için bu metadata yalnız anonim vitrin ziyaretçisinde render edilir.
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  const description =
    "Müşteri isteklerini topla, AI ile analiz et, gelir skoruyla önceliklendir ve yayınlanınca herkese duyur. Hosted, ücretsiz başla.";
  return {
    description,
    openGraph: {
      title: "feedl — AI Destekli Müşteri Geri Bildirim Platformu",
      description,
      url: process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app",
      type: "website",
      images: [ogImage()],
    },
    twitter: {
      card: "summary_large_image",
      title: "feedl — AI Destekli Müşteri Geri Bildirim Platformu",
      description,
      images: [ogImage()],
    },
    ...canonical,
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff5c35",
};

// Sprint 50 (Faz 4/cilama) — "/" artık SATIŞ landing'idir. Portal / yol
// haritası / güncellemeler nav'dan çıkarıldı; ürün örnekleri /demo'ya taşındı.
// Hedef: feedl'i (SaaS) satın alacak şirket temsilcisi. Portal yüzeyleri son
// kullanıcıya ait olduğundan "fikir verme / göz at" çağrıları yerine
// "Ücretsiz Başla", "Canlı Demo", "Fiyatlandırma" CTA'ları var.
// Giriş yapmışsa role göre dashboard/portal yönlendirmesi. Rolün TEK kaynağı
// workspace_members'tır (3 kademe, 2026-09-11): owner → "owner", manager →
// "admin", member → "team"; üyeliği olmayan → portal. Ham `users.role` sütunu
// kullanılmaz — o sütun feedl PLATFORM personelini işaret eder ve workspace
// yetkisi vermez.
// Sprint 63 (rev.): onboarding'e YALNIZCA SaaS-funnel signup butonlarının
// redirectUrl'u ile gidilir; burada owner/manager/member→dashboard, üyeliği
// olmayan→portal kalır — portal uç kullanıcısı onboarding'e hiç gönderilmez.
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    // Hedef TEK kaynaktan gelir (`getNonAdminRedirectTarget`): owner/manager/
    // member → /dashboard, üyeliği olmayan → /portal. Burada daha önce elle rol
    // karşılaştırması vardı ve `owner` unutulmuştu → ürünü satın alan owner
    // /portal'a düşüyordu (2026-09-12 hatası). Hata durumunda güvenli geri
    // dönüş korunur: /portal.
    let target = "/portal";
    try {
      target = await getNonAdminRedirectTarget();
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

  // P0-2: workspace'i immutable UUID ile billing'e bağla (slug değişebilir).
  // Landing anonim vitrin ise default 'feedl' workspace'ini çözer; hata olursa
  // null → PricingManager slug fallback kullanır.
  const landingWorkspaceId = await getWorkspaceId().catch(() => null);

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
  // 2026-09-12 (Free/Pro dil birliği): metinler plan kartlarındaki gerçek plan
  // içeriğiyle hizalandı — Free'de olmayan bir şey Free gibi, Free'de olan bir
  // şey de Pro gibi anlatılmaz. Kanonik konumlandırma: PLAN_POSITIONING
  // (lib/plan-copy.ts — NOT: components/custom/plan-config.ts DEĞİL; o dosya
  // "use client" taşır ve sunucu bileşeninde değerleri undefined yapar).
  const features = [
    {
      title: "AI Autopilot",
      description:
        "Her fikri otomatik etiketler, özetler ve tekrarları işaretler. Kopyalarla uğraşmazsın.",
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
      title: "Çalışma Alanı & Roller",
      description:
        "Çalışma alanını kur, sahip/yönetici/üye rolleriyle çalış. Tek kişilik Free workspace ile başla; ekip üyelerini Pro'da ekle.",
      icon: UsersIcon,
      plan: "free",
    },
    {
      title: "Güvenlik & Gizlilik",
      description:
        "Rol bazlı erişim ve özel iç notlarla müşteri ve ekip verilerini ayrı tut.",
      icon: ShieldCheckIcon,
      plan: "free",
    },
    {
      title: "İş Akışı & Görünümler",
      description:
        "Kayıtlı filtreler, toplu aksiyonlar ve sayfalama ile kalabalık panoları yönet.",
      icon: WorkflowIcon,
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
      title: "AI Destekli Yanıt (Triage)",
      description:
        "Müşteri widget'ında serbest mesajı AI sınıflandırır; desteği ayrıştırır, geri bildirimi fikre çevirir.",
      icon: BotIcon,
      plan: "pro",
    },
    {
      title: "CSV İçe / Dışa Aktarma",
      description:
        "Mevcut fikirlerini CSV ile taşı; panelini tek tıkla dışa aktar.",
      icon: UploadIcon,
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
  ];

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                name: "feedl",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                description:
                  "Müşteri geri bildirimini toplama, AI ile analiz etme, önceliklendirme ve duyurma platformu.",
                url: process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
              },
              {
                "@type": "Organization",
                name: "feedl",
                url: process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app",
                email: "hi@feedl.app",
              },
            ],
          }),
        }}
      />
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          {/* Sprint 63z: hero marka kimliği — başlığın üstünde turuncu logo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_brand_orange.svg"
            alt="feedl"
            className="hero-rise mb-5 h-14 w-14 shrink-0 object-contain"
          />
          <h1 className="hero-rise max-w-xl text-4xl font-bold sm:text-5xl lg:text-6xl">
            Müşteri isteklerini tahminle değil, veriyle önceliklendir.
          </h1>
          <p
            className="hero-rise mt-4 max-w-xl text-lg text-muted-foreground"
            style={{ animationDelay: "60ms" }}
          >
            Fikirleri toplamak, oylamak ve AI ile analiz etmek için tek
            platform. Hosted ve ücretsiz başlangıç — müşterin hesap açmadan geri
            bildirim versin, ürününü müşteri sesiyle şekillendir.
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
              render={<Link href="/#pricing" />}
            >
              Fiyatlandırma
            </Button>
          </div>
        </div>

        <div aria-hidden="true" className="hero-rise" style={{ animationDelay: "180ms" }}>
          {/* F5: mock kart — DemoPostCard yerine tek kaynak IdeaCard (link'siz,
              aria-hidden). frontend-design: tek orkestralı "yeni oy geldi" pop'u
              HeroDemoCard'da (128→129, ölçülü; reduced-motion'da statik). */}
          <HeroDemoCard />
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
                      ? "border-brand/40 bg-brand/10 text-brand-strong"
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

      {/* `id` — eski /pricing bağlantıları ve nav artık buraya çapa atıyor
          (`/#pricing`). `scroll-mt-20` sticky üst barın (h-14) altında kalmasın. */}
      <section id="pricing" className="mt-20 scroll-mt-20 sm:mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Hangi plan sana uygun?
          </h2>
          {/* 2026-09-12 (Free/Pro dil birliği): Pro'nun "neden para ödeyeyim?"
              cevabı tek cümlede — özellik listesinden önce konumlandırma.
              Kanonik kaynak: PLAN_POSITIONING (lib/plan-copy.ts). */}
          <p className="mt-3 text-muted-foreground">
            {PLAN_POSITIONING.free} {PLAN_POSITIONING.pro} Her plan kullanıcı
            başına değil, ekip başına fiyatlandırılır.
          </p>
        </div>

        {/* Sprint 63r + 2026-09-13: tek standart plan kartları. Önceden ayrı bir
            `/pricing` sayfası vardı; artık AYNI PricingManager yalnız burada —
            sayfa kaldırıldı (kullanıcı kararı), eski yol buraya yönlenir. */}
        <div className="mt-10">
          <PricingManager workspaceSlug="feedl" workspaceId={landingWorkspaceId} />
        </div>

        {/* Sprint 69.2–69.4 notları — `/pricing` sayfası kaldırıldığı için buraya
            taşındı (2026-09-13). Aksi halde bu üç açıklama kullanıcıya hiç
            görünmezdi: hesap düzeyi Pro kuralı, para birimi ve deneme↔cayma
            ayrımı. Sunucu-safe kaynak: lib/plan-copy.ts. */}
        <div className="mt-6 grid gap-2 text-center text-sm text-muted-foreground">
          <p>{ACCOUNT_PRO_NOTE}</p>
          <p className="text-xs">
            Ödeme Paddle tarafından güvenle işlenir (merchant of record).{" "}
            {priceCurrencyNote()} {TRIAL_VS_WITHDRAWAL_NOTE}
          </p>
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

      {/* Self-embed artık (main) layout'ta tek yerden yönetilir (yüzey listesi:
          lib/widget/embed.ts). */}
    </main>
  );
}
