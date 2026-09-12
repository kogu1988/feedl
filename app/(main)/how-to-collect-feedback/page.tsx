import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FreeBadge, ProBadge } from "@/components/custom/pro";
import { generateCanonical } from "@/lib/seo";

// SEO: benzersiz title + canonical. Bu sayfa "how to collect customer feedback"
// bilgilendirme niyetini hedefler; numbered adımlar GERÇEK bir dizidir (kurulum
// rehberi) — DESIGN.md §3 "numbered marker yalnız sıra gerçekse kullan" kuralına uyar.
//
// 2026-09-12 (Free/Pro dil birliği): adımlar hangi planda yapılabildiğini
// AÇIKÇA işaretler. Önceden gelir skoru ve entegrasyonlar da standart akış
// gibi sunuluyordu; ikisi de Pro özelliği olduğundan Free kullanıcıya
// yapamayacağı bir akış anlatılıyordu. Plan matrisi: PLAN_POSITIONING
// (components/custom/plan-config.ts).
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Müşteri geri bildirimi nasıl toplanır",
    description:
      "Adım adım: feedl ile müşteri isteklerini topla, AI ile sınıflandır ve duyur. Free ile başla, Pro ile gelir skoru ve entegrasyonları ekle. Kurulum 2 dakika.",
    ...canonical,
  };
}

const STEPS = [
  {
    title: "Hesap oluştur ve çalışma alanını kur",
    text: "feedl'a kayıt ol, adını ve marka rengini seç. Subdomain (ornek.feedl.app) ve portal bağlantın otomatik hazırlanır.",
    plan: "free",
  },
  {
    title: "İlk geri bildirim board'unu oluştur",
    text: "Bir board ekle (ör. 'Özellik istekleri'). Board, fikirlerin toplandığı temel kutudur.",
    plan: "free",
  },
  {
    title: "Fikir toplamaya başla: portal linki + widget",
    text: "Public board'u müşterilerine paylaş, ya da widget'ı kendi sitene 2 satır script ile göm. Anonim, e-posta veya kayıtlı gönderim modunu seç.",
    plan: "free",
  },
  {
    title: "AI her fikri otomatik analiz etsin",
    text: "Feedl her içgörüyü etiketler, özetler, duygu analizini çıkarır ve benzer istekleri tekrar olarak işaretler — tahmin değil, veri.",
    plan: "free",
  },
  {
    title: "Gelir skoruyla önceliklendir",
    text: "Her istek oy + müşteri sayısı + açık fırsat (MRR) ile skorlanır. En değerli istek en üste gelir; yalnızca oya bakmazsın.",
    plan: "pro",
  },
  {
    title: "Yol haritasına taşı ve duyur",
    text: "Kazananı Yol Haritası'na al; durumu geliştirildi/yayında yap. Yayına alınca oy veren ve takip eden herkese otomatik e-posta gider.",
    plan: "free",
  },
  {
    title: "Ekip araçlarınla entegre et",
    text: "Slack, Linear, Jira, Zendesk entegrasyonları ve public API + webhook ile geri bildirimleri mevcut iş akışına bağla.",
    plan: "pro",
  },
];

// Free/Pro akış özeti — rehberin tek cümlelik iki seviyesi.
const FREE_FLOW = [
  "İstekleri topla (portal + widget)",
  "Oylama ile talep sırala",
  "AI etiketleme, özet ve tekrar tespiti",
  "Yol haritası ve değişiklik günlüğü ile duyur",
];

const PRO_FLOW = [
  "Slack, Jira, Linear, Zendesk, Intercom entegrasyonları",
  "AI içgörüleri (tüm korpus analizi)",
  "Gelir skoru (oy + müşteri + fırsat/MRR)",
  "Özel alan adı, marka kaldırma, API + webhook",
];

export default function HowToCollectFeedbackPage() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Müşteri geri bildirimi nasıl toplanır — feedl",
        description:
          "feedl ile müşteri isteklerini toplama, AI ile analiz etme, gelir skoruyla önceliklendirme ve duyurma adımları.",
        url: `${base}/how-to-collect-feedback`,
      },
      {
        "@type": "HowTo",
        name: "Müşteri geri bildirimi feedl ile nasıl toplanır",
        description: "Yedi adımda müşteri isteklerini topla, önceliklendir ve duyur.",
        step: STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.title,
          text: s.text,
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

      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Müşteri geri bildirimi nasıl toplanır — feedl ile 7 adım
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          İstekleri toplamak kolay; asıl zor kısım hangisinin önce geleceğine karar
          vermek. Bu rehber, feedl&apos;deki uçtan uca akışı gösterir. İlk dört adım
          Free planda yapılır; gelir skoru ve entegrasyon adımları Pro&apos;ya geçince
          açılır.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button render={<Link href="/sign-up" />}>Ücretsiz Başla</Button>
          <Button variant="outline" render={<Link href="/demo" />}>Canlı Demoyu Gör</Button>
        </div>
      </div>

      {/* Free/Pro akış özeti — kullanıcı hangi adımları ŞU AN yapabileceğini
          adım listesine girmeden görebilsin (2026-09-12 Free/Pro dil birliği). */}
      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Free ile</h2>
            <FreeBadge />
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {FREE_FLOW.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* DİKKAT: burada `bg-brand-tint` KULLANILMAZ. ProBadge kendi
            `bg-brand/10` zeminini taşır; ikisi üst üste binince
            (brand-strong #c7360f üzerine ~#ffe6de) kontrast 4.44:1'e düşüp
            WCAG AA'yı (4.5:1) 0.06 ile kırıyordu. Marka vurgusu kenarlıkla
            verilir, zemin nötr kalır (2026-09-12 a11y). */}
        <div className="rounded-2xl border border-brand/40 bg-card p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Pro ile ek olarak</h2>
            <ProBadge />
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {PRO_FLOW.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Gerçek sıralı dizi → numbered <ol> (template tell değil, içerik dizi). */}
      <ol className="mx-auto mt-14 max-w-3xl space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-sm tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{step.title}</h2>
                {step.plan === "pro" ? (
                  <ProBadge />
                ) : (
                  <FreeBadge />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Kapanış CTA */}
      <section className="mx-auto mt-16 max-w-3xl rounded-2xl border bg-brand-soft p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">İlk fikri birkaç dakikada topla</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Kurulum yok, kredi kartı yok. Free planla bugün başla; gelir verisini ve
          ekip araçlarını iş akışına katmak istediğinde Pro&apos;ya geç.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/sign-up" />}>Kayıt Ol</Button>
          <Button variant="outline" render={<Link href="/pricing" />}>Fiyatlandırmayı Gör</Button>
        </div>
      </section>
    </main>
  );
}
