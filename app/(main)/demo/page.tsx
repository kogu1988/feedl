import Link from "next/link";
import { RocketIcon, RouteIcon, MegaphoneIcon } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { DemoPostCard } from "@/components/custom/demo-post-card";

// Sprint 50 (Faz 4/cilama) — public /demo. Ürünün çalışan örnek yüzeylerini
// sunan bir tur sayfası: portal / yol haritası / güncellemeler. Satış
// landing'inden (/), "Canlı Demo" butonuyla buraya gelinir. Son kullanıcıya
// değil, ürünü değerlendiren şirket temsilcisine hitap eder.
export const dynamic = "force-dynamic";

const surfaces = [
  {
    title: "Fikir Portalı",
    description:
      "Müşteriler özellik ister, başkaları oy verir. En çok istenen özellik kendiliğinden üste çıkar.",
    href: "/portal",
    icon: RocketIcon,
  },
  {
    title: "Yol Haritası",
    description:
      "Planlanan / geliştirilen / yayınlanan — herkesin gördüğü şeffaf bir yol haritası.",
    href: "/roadmap",
    icon: RouteIcon,
  },
  {
    title: "Güncellemeler",
    description:
      "Yayına alınan her özellik, oy verenlere e-posta ile duyurulur ve değişiklik günlüğüne düşer.",
    href: "/portal/changelog",
    icon: MegaphoneIcon,
  },
];

export default function DemoPage() {
  return (
    <main className="container mx-auto max-w-none px-4 pb-16 pt-12 sm:pt-20">
      <section>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          feedl gerçekte nasıl görünüyor?
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Aşağıdaki yüzeyler feedl&apos;in canlı örnekleridir. Kendi müşterilerinin
          isteklerini bu şekilde toplayıp, analiz edip duyurabilirsin.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignUpButton>
            <Button size="lg">Ücretsiz Başla</Button>
          </SignUpButton>
          <Button size="lg" variant="outline" render={<Link href="/pricing" />}>
            Fiyatlandırma
          </Button>
        </div>
      </section>

      {/* Ürün yüzeyleri */}
      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        {surfaces.map((surface) => (
          <Link key={surface.href} href={surface.href} className="group">
            <div className="flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary">
              <surface.icon
                className="size-6 text-brand"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-lg font-semibold">{surface.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {surface.description}
              </p>
              <span className="mt-4 text-sm font-medium text-primary">
                Örneği aç →
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Örnek fikir kartı — gerçek portal yapısı (tıklanamaz) */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold">Örnek bir fikir kartı</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Portalda her fikir bu şekilde görünür; oy, durum, duygu ve etiketler
          otomatik dolar.
        </p>
        <div className="mt-6 max-w-2xl" aria-hidden="true">
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
    </main>
  );
}
