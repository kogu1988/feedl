import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateCanonical } from "@/lib/seo";

// SEO: benzersiz title + canonical (root template "%s · feedl" "feedl"i bir kez
// ekler). Bu sayfa "Canny alternative" ticari niyetini hedefler.
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Canny Alternative",
    description:
      "Canny yerine feedl: müşteri isteklerini AI ile sınıflandır, gelir skoruyla önceliklendir ve ücretsiz başla. Editör başına değil ekip başına fiyatlandırma.",
    ...canonical,
  };
}

const FEATURES = [
  "Fikir + oy + yorum + takip",
  "AI etiketleme & özet (otomatik sınıflandırma)",
  "Duygu analizi + benzerlik tespiti",
  "Gelir skoru (oy + müşteri + fırsat)",
  "Yol haritası + değişiklik günlüğü (public)",
  "Gömülebilir widget (kendi siten)",
  "Entegrasyonlar (Slack, Zendesk, Linear, Jira)",
  "Public API + webhook",
  "Özel alan adı + marka kaldırma",
];

const DIFFERENCES = [
  { title: "AI her içgörüde", text: "Otomatik etiket, özet, duygu ve benzerlik; tahminle değil veriyle karar ver." },
  { title: "Gelir bağlamı", text: "Oy + müşteri + açık fırsat (MRR) ile gerçekten değerli isteği üste taşı." },
  { title: "Ekip başı fiyat", text: "Kullanıcı başına değil ekip başına — küçük ekipte öngörülebilir maliyet." },
  { title: "Hosted, kurulum yok", text: "Birkaç dakikada yayına al; veri/auth altyapısından bizi ilgilendirme." },
];

const FAQ = [
  {
    q: "feedl bir Canny alternatifi midir?",
    a: "Evet. Feedl, Canny gibi müşteri geri bildirimini toplar, oylar, önceliklendirir ve duyurur; ancak bunu AI sınıflandırma, duygu analizi ve gelir skoruyla birlikte yapar.",
  },
  {
    q: "Canny'den farkı nedir?",
    a: "Feedl her içgörüde AI kullanır (etik, özet, duygu, benzerlik) ve oy + müşteri + fırsat değeriyle gelir skoru üretir. Ayrıca kullanıcı başına değil ekip başına fiyatlandırır.",
  },
  {
    q: "Ücretsiz bir plan var mı?",
    a: "Evet. Ücretsiz plan 1 board, 1 üye ve 50 takipçi içerir; Pro (aylık/yıllık) sınırsız board, entegrasyonlar, AI içgörüleri ve API erişimi sunar.",
  },
  {
    q: "Kendi siteme gömebilir miyim?",
    a: "Evet. Widget, herhangi bir siteye birkaç satır script ile gömülür; anonim, e-posta veya kayıtlı gönderim modlarından birini seçersin.",
  },
  {
    q: "Verilerimiz güvende mi?",
    a: "Feedl Clerk ile kimlik doğrular, Neon Postgres'te veri tutar ve entegrasyon secret'larını şifreler (AES-256-GCM). Data, workspace'e göre izole edilir.",
  },
];

function CheckItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  );
}

export default function CannyAlternativePage() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "feedl — Canny Alternative",
        description:
          "Canny yerine feedl: müşteri isteklerini AI ile sınıflandır, gelir skoruyla önceliklendir, ücretsiz başla.",
        url: `${base}/canny-alternative`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: base },
          { "@type": "ListItem", position: 2, name: "Canny Alternative", item: `${base}/canny-alternative` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <Badge className="border-border bg-muted text-muted-foreground">
            Canny&apos;ye ücretsiz, hosted alternatif
          </Badge>
          <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Canny yerine: müşteri isteklerini AI ile, veriyle önceliklendir.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Feedl, Canny&apos;nin toplama ve oylama akışını AI sınıflandırma,
            duygu analizi ve gelir skoruyla birleştirir. Kurulum yok, ücretsiz başla.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" render={<Link href="/sign-up" />}>Ücretsiz Başla</Button>
            <Button size="lg" variant="outline" render={<Link href="/demo" />}>Canlı Demoyu Gör</Button>
          </div>
        </div>
        {/* Öne çıkan fark — tek bold an: gelir skoru */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Gelir Skoru</p>
            <Badge className="border-brand/40 bg-brand/10 text-brand">AI + Veri</Badge>
          </div>
          <p className="mt-4 font-mono text-3xl tabular-nums">4.2</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Oy × müşteri × açık fırsat — en değerli isteği yalnız oyla değil,
            gelir bağlamıyla üste taşır.
          </p>
        </div>
      </section>

      {/* Özellik listesi */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Feedl&apos;de ne var</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Canny&apos;den bildiğin çekirdek akışın tamamı, fazlasıyla.
        </p>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <CheckItem key={f} text={f} />
          ))}
        </ul>
      </section>

      {/* Neden farklı */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Neden feedl?</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {DIFFERENCES.map((d) => (
            <div key={d.title} className="rounded-lg border p-5">
              <h3 className="text-base font-semibold">{d.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fiyatlandırma özeti */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Basit fiyatlandırma</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border bg-card p-6">
            <p className="text-lg font-semibold">Free</p>
            <p className="mt-2 text-4xl font-bold tracking-tight">$0</p>
            <p className="mt-1 text-sm text-muted-foreground">şimdilik ücretsiz — küçük ekipler için</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>1 board · 1 üye · 50 takipçi</li>
              <li>Fikir + oy + yorum</li>
              <li>AI etiketleme & tek post özeti</li>
              <li>Widget gömülü</li>
            </ul>
          </div>
          <div className="flex h-full flex-col rounded-2xl border border-primary bg-primary/5 p-6">
            <p className="text-lg font-semibold">Pro</p>
            <p className="mt-2 text-4xl font-bold tracking-tight">$19<span className="text-sm font-normal text-muted-foreground">/ay</span></p>
            <p className="mt-1 text-sm text-muted-foreground">sınırsız board, entegrasyonlar, AI içgörüleri</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Entegrasyonlar (Slack, Zendesk, Linear, Jira)</li>
              <li>Özel alan adı + marka kaldırma</li>
              <li>API + webhook + public portal</li>
              <li>Gelir skoru & gelişmiş planlama</li>
            </ul>
          </div>
        </div>
        <div className="mt-8">
          <Button render={<Link href="/pricing" />}>Fiyatlandırmayı Ver</Button>
        </div>
      </section>

      {/* SSS (FAQPage schema'nın kaynağı) */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Sık sorulanlar</h2>
        <div className="mt-6 max-w-3xl space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-lg border p-5">
              <h3 className="text-base font-semibold">{f.q}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Kapanış CTA */}
      <section className="mt-20 rounded-2xl border bg-brand-soft p-8 text-center sm:mt-24">
        <h2 className="text-2xl font-bold tracking-tight">Bugün ücretsiz başla</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Müşteri isteklerini topla, AI ile analiz et, gelir skoruyla önceliklendir.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/sign-up" />}>Kayıt Ol</Button>
          <Button variant="outline" render={<Link href="/demo" />}>Demoyu Gör</Button>
        </div>
      </section>
    </main>
  );
}
