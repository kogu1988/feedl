import Link from "next/link";
import { RocketIcon, RouteIcon, MegaphoneIcon } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

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
    <main className="container mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pt-20">
      <section className="text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          feedl gerçekte nasıl görünüyor?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Aşağıdaki yüzeyler feedl&apos;in canlı örnekleridir. Kendi müşterilerinin
          isteklerini bu şekilde toplayıp, analiz edip duyurabilirsin.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        <div className="mx-auto mt-6 max-w-2xl" aria-hidden="true">
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
    </main>
  );
}
