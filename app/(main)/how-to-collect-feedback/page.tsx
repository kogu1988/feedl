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
// (lib/plan-copy.ts).
//
// 2026-09-13 (kullanıcı isteği): sayfa GENİŞLETİLDİ. Önce yalnız 7 adım vardı;
// rehber niteliği taşıması için eklendi: adım içi detay maddeleri, kanal seçim
// tablosu, soru tasarımı (iyi/kötü örnek), toplanacak bağlam, sık yapılan
// hatalar, ölçüm metrikleri, müşteriye gönderilecek hazır davet metni ve SSS.
// İçerik dürüst kalır: abartılı iddia ve rakip marka adı YOK (README söz dağarcığı).
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Müşteri geri bildirimi nasıl toplanır",
    description:
      "Uçtan uca rehber: hangi kanaldan toplayacaksın, ne soracaksın, hangi bağlamı kaydedeceksin ve istekleri nasıl önceliklendireceksin. Hazır davet metni, sık yapılan hatalar ve ölçüm metrikleri dahil.",
    ...canonical,
  };
}

// ── 7 adım (gerçek sıra) — her adımda kısa açıklama + uygulama detayı ────────
const STEPS = [
  {
    title: "Hesap oluştur ve çalışma alanını kur",
    text: "feedl'a kayıt ol, adını ve marka rengini seç. Subdomain (ornek.feedl.app) ve portal bağlantın otomatik hazırlanır.",
    details: [
      "Marka rengi portalın üst barında ve widget'ında kullanılır; müşteri kendi markanı görür.",
      "İstersen kurulumda “örnek verilerle göster” seçeneğiyle panonu dolu görüp akışı baştan inceleyebilirsin; örnekler tek tıkla silinir.",
    ],
    plan: "free",
  },
  {
    title: "İlk geri bildirim board'unu oluştur",
    text: "Bir board ekle (ör. 'Özellik istekleri'). Board, fikirlerin toplandığı temel kutudur.",
    details: [
      "Tek board ile başla; fikirler büyüdükçe ayır (ör. “Özellik istekleri”, “Hata bildirimleri”).",
      "Board'u public ya da gizli yapabilirsin — gizli board'lar Pro'dadır ve portalda görünmez.",
    ],
    plan: "free",
  },
  {
    title: "Fikir toplamaya başla: portal linki + widget",
    text: "Public board'u müşterilerine paylaş, ya da widget'ı kendi sitene 2 satır script ile göm. Anonim, e-posta veya kayıtlı gönderim modunu seç.",
    details: [
      "Portal linki en hızlı yol: linki e-postaya, dokümanına veya ürün içi bir bağlantıya koy.",
      "Widget'ı ürününün içine gömünce geri bildirim, kullanıcının sorunu yaşadığı anda gelir (sayfa bağlamı da kaydedilir).",
      "Anonim gönderim, geri bildirim verme eşiğini düşürür; kayıtlı mod ise kimin istediğini bilmeni sağlar. İkisini birlikte kullanmak yerine bilinçli seç.",
    ],
    plan: "free",
  },
  {
    title: "AI her fikri otomatik analiz etsin",
    text: "Feedl her içgörüyü etiketler, özetler, duygu analizini çıkarır ve benzer istekleri tekrar olarak işaretler — tahmin değil, veri.",
    details: [
      "Aynı isteği 40 kişi ayrı ayrı yazmış olabilir; benzerlik tespiti bunları tek fikirde birleştirmeni sağlar.",
      "AI yanılırsa düzelt: bir fikri “ilgisiz” işaretlemek veya türünü değiştirmek sonraki sınıflandırmayı yönlendirir.",
    ],
    plan: "free",
  },
  {
    title: "Gelir skoruyla önceliklendir",
    text: "Her istek oy + müşteri sayısı + açık fırsat (MRR) ile skorlanır. En değerli istek en üste gelir; yalnızca oya bakmazsın.",
    details: [
      "Bunun çalışması için şirket kaydı ve MRR girmen gerekir; elle ya da CSV ile içe aktarabilirsin.",
      "Skor bir kara kutu değil: fikrin detayında “bu skor nasıl hesaplandı?” dökümünü görürsün.",
      "Yüksek oy her zaman önce gelmez — 3 müşterinin istediği ama yüksek gelirli bir ihtiyaç, 90 oylu genel bir isteği geçebilir.",
    ],
    plan: "pro",
  },
  {
    title: "Yol haritasına taşı ve duyur",
    text: "Kazananı Yol Haritası'na al; durumu geliştirildi/yayında yap. Yayına alınca oy veren ve takip eden herkese otomatik e-posta gider.",
    details: [
      "Durumu değiştirdiğinde iç not otomatik düşer; ekibin neden o kararı verdiği kayıtlı kalır.",
      "Yayınlanan her özellik değişiklik günlüğüne düşer — geri bildirim verenler emeğinin karşılığını görür ve tekrar geri bildirim verir.",
    ],
    plan: "free",
  },
  {
    title: "Ekip araçlarınla entegre et",
    text: "Slack, Linear, Jira, Zendesk entegrasyonları ve public API + webhook ile geri bildirimleri mevcut iş akışına bağla.",
    details: [
      "Destek konuşmalarını (Zendesk, Intercom) ve mesajlarını (Slack) otomatik olarak fikre dönüştür.",
      "Public API + webhook ile kendi panelinde rapor üretebilir ya da CI/otomasyonuna bağlayabilirsin.",
    ],
    plan: "pro",
  },
];

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

// ── Kanal seçimi — "nereden toplamalıyım?" ─────────────────────────────────
const CHANNELS = [
  {
    name: "Public portal",
    when: "Sürekli, açık bir toplama yüzeyi istiyorsan",
    good: "Herkes görebilir, oylayabilir; link paylaşmak yeterli",
    watch: "Zayıf sinyal birikimi — başlık standardı koy",
  },
  {
    name: "Widget (ürün içi)",
    when: "Kullanıcı sorunu tam o an yaşıyorken",
    good: "Bağlam kaydedilir (sayfa, cihaz, tarayıcı); en doğru an",
    watch: "Her sayfaya koymak gürültü yaratır — doğru yerlere koy",
  },
  {
    name: "E-posta / bülten",
    when: "Mevcut müşteri tabanına ulaşmak istiyorsan",
    good: "Tek seferde geniş erişim; portal linkine yönlendirir",
    watch: "Yanıt oranı düşer — kısa tut, tek bir soru sor",
  },
  {
    name: "Destek araçları (Zendesk vb.)",
    when: "Talep zaten destek üzerinden geliyorsa",
    good: "Otomatik olarak fikre dönüşür; ayrı yere girmen gerekmez",
    watch: "Destek = hata baskın olur; özellik isteğini ayıkla",
  },
  {
    name: "Müşteri görüşmesi",
    when: "Nadir ama yüksek değerli müşteriler için",
    good: "“Neden”i öğrenirsin — en yüksek bilgi yoğunluğu",
    watch: "Ölçeklenmez; çıktıyı mutlaka panoya aktar",
  },
];

// ── Soru tasarımı ──────────────────────────────────────────────────────────
const QUESTION_DOS = [
  "Problemi sor, çözümü değil: “Bu işi bugün nasıl yapıyorsun?”",
  "Son yaşanmış bir örneği iste: “En son ne zaman takıldın?”",
  "Etkiyi ölç: “Bu olmasa ne kaybediyorsun, ne kadar zaman/sürüm?”",
  "Kimin için olduğunu netleştir: rol, ekip büyüklüğü, plan",
];

const QUESTION_DONTS = [
  "“Bu özelliği ister miydin?” — herkese evet dedirtir, sinyal değeri düşük",
  "“Şu özelliği yapıyoruz, ne dersin?” — yönlendirici, itirazı bastırır",
  "İki soruyu tek soruya sıkıştırmak — birini kaybedersin",
  "Cevabı yorumlamak yerine çözüm söylemek — ihtiyacı gizler",
];

// ── Kaydedilmesi gereken bağlam ────────────────────────────────────────────
const CONTEXT_FIELDS = [
  { field: "Kim", why: "Rol ve şirket — aynı isteğin farklı segmentlerde anlamı değişir" },
  { field: "Ne kadar değerli", why: "MRR / açık fırsat — önceliğin gelir tarafı" },
  { field: "Nerede", why: "Sayfa URL'i ve board — sorunun ürünün neresinde olduğu" },
  { field: "Hangi cihaz", why: "Masaüstü/tablet/mobil + viewport — dağılımı ve mobil sorunları ayıklar" },
  { field: "Ne zaman", why: "Tarih — trend ve “ne zamandır bekliyor” sorusu" },
  { field: "Kaç kişi", why: "Tekil oy mu, tekrar birleşmiş mi — gerçek talep büyüklüğü" },
];

const MISTAKES = [
  {
    title: "Toplamayı önceliklendirmeyle karıştırmak",
    text: "100 fikir toplayıp hangisinin önce geleceğine karar verememek, hiç toplamamaktan farksızdır. Biriktirme aşamasını karar aşamasından ayır.",
  },
  {
    title: "Yalnız “en çok oy”a bakmak",
    text: "En çok oy alan istek, en çok sesi çıkan azınlığın isteği olabilir. Talebi gelir ve müşteri ağırlığıyla birlikte oku.",
  },
  {
    title: "Sessiz çoğunluğu kaçırmak",
    text: "Memnun ve sessiz müşteri geri bildirim vermez. Oyu olmayan ama planı yüksek müşteriyi de masaya koy.",
  },
  {
    title: "Kararı kaydetmemek",
    text: "“Bunu yapmayacağız” da bir karardır. Gerekçeyi iç nota yazmazsan 3 ay sonra aynı tartışma baştan yaşanır.",
  },
  {
    title: "Duyurmamak",
    text: "Geri bildirimin karşılığı görmek, bir sonraki geri bildirimi getirir. Yayınladığında mutlaka haber ver.",
  },
];

const METRICS = [
  { name: "Yanıt oranı", how: "Geri bildirim veren / davet edilen", target: "Portal+widget ile %5–15 makul başlangıç" },
  { name: "Fikir başına oy", how: "Toplam oy / toplam fikir", target: "Ortalama 1'in üstündeyse oylama çalışıyor" },
  { name: "Fikirden karara süre", how: "Oluşturma → durum değişikliği (planlandı+)", target: "Haftalar değil, günler" },
  { name: "Aktivasyon", how: "Workspace hangi adıma kadar geldi?", target: "İlk fikir + ilk müşteri bağlantısı" },
  { name: "Kapanan döngü", how: "Yayınlanan / duyurulan fikir oranı", target: "%100'e ne kadar yakınsa güven o kadar yüksek" },
];

// ── "Neden feedl?" — rehberin kendi kriterleriyle bağlantılı farklılaşma ────
//
// KURAL: her madde, rehberin DAHA ÖNCE kurduğu bir problemle eşleşir. Genel
// pazarlama cümlesi değil; "bu adımı elle yaparsan şu olur, bizde şu olur".
// Rakip marka adı YOK, kanıtsız üstünlük iddiası YOK (README söz dağarcığı).
const WHY_FEEDL = [
  {
    problem: "“En çok oy alan” ile “en çok değer yaratan” ayrılamıyor",
    solution:
      "Her istek oy + müşteri sayısı + açık fırsat (MRR) ile skorlanır. Böylece 3 yüksek gelirli müşterinin istediği bir ihtiyaç, 90 oylu genel bir isteği geçebilir.",
    plan: "pro",
  },
  {
    problem: "Yüzlerce fikri elle etiketlemek/özetlemek sürüyor",
    solution:
      "AI her yeni fikirde otomatik çalışır: etiket, özet, duygu analizi ve tekrar tespiti. Triyaj işi fikrin geldiği anda biter.",
    plan: "free",
  },
  {
    problem: "AI yanlış sınıflandırınca kimse düzeltmiyor",
    solution:
      "Bir fikri “ilgisiz” işaretlemek ya da türünü düzeltmek bu workspace'e özel bir sinyale dönüşür ve sonraki sınıflandırmaları yönlendirir.",
    plan: "free",
  },
  {
    problem: "“Duyurmamak” hatası — geri bildirim veren sesini duymuyor",
    solution:
      "Kapalı döngü: portal → oy → yol haritası → değişiklik günlüğü. Durumu “yayında” yaptığın an oy veren ve takip eden herkese e-posta otomatik gider.",
    plan: "free",
  },
  {
    problem: "“Kim, nerede, hangi cihazda?” bilgisi kayboluyor",
    solution:
      "Widget ürünün içinde çalışır; sayfa, cihaz, viewport, tarayıcı ve işletim sistemi otomatik kaydedilir. Görsel geri bildirimde sorunlu nokta işaretlenip ekran görüntüsü eklenir.",
    plan: "free",
  },
  {
    problem: "Kararın “işe yaradı mı?” sorusu hiç cevaplanmıyor",
    solution:
      "Yayına giren bir fikrin gerçekleşen sonucunu (genişleme / elde tutma / verimlilik + gelir etkisi) kaydedersin; birikim zamanla önceliklendirmeyi tahminden çıkarır.",
    plan: "pro",
  },
];

// ── Karşılaştırma — "neden hazır bir araç?" ────────────────────────────────
// Kategoriler GENEL tutulur (marka adı yok) ve takas dürüstçe yazılır:
// kendi geliştirme en esnek ama mühendislik zamanı ister.
const COMPARISON = [
  {
    criterion: "Fikir toplama yüzeyi",
    manual: "E-posta + tablo: her yeni fikir elle satır olur",
    formTool: "Form var, ama oylama/roadmap yok",
    build: "Var — geliştirme süresi",
    feedl: "Portal + widget (2 satır script) hazır",
  },
  {
    criterion: "Oylama ve sıralama",
    manual: "Elle sayılır, güncel kalmaz",
    formTool: "Yok / eklenti ile sınırlı",
    build: "Var — geliştirme süresi",
    feedl: "Oylama + sıralama kutudan çıkar",
  },
  {
    criterion: "AI triyaj (etiket/özet/tekrar)",
    manual: "Yok — tamamen elle",
    formTool: "Yok",
    build: "Var — model maliyeti ve bakımı sende",
    feedl: "Her fikirde otomatik çalışır",
  },
  {
    criterion: "Gelir ağırlıklı öncelik",
    manual: "Yok — oy sayısı tek sinyal",
    formTool: "Yok",
    build: "Var — veri modelini sen kurarsın",
    feedl: "Oy + müşteri + fırsat/MRR skoru ve açıklaması",
  },
  {
    criterion: "Duyuru döngüsü",
    manual: "Elle e-posta listesi",
    formTool: "Yok",
    build: "Var — geliştirme süresi",
    feedl: "Roadmap + changelog + otomatik bildirim",
  },
  {
    criterion: "Kurulum ve bakım",
    manual: "Kurulum yok, ama sürekli emek",
    formTool: "Hızlı kurulur, geri kalanı yok",
    build: "En esnek; en yüksek mühendislik maliyeti",
    feedl: "Hosted ve hazır; bakım bizde",
  },
];

// ── SSS ────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "Müşteri geri bildirimini toplamaya nereden başlamalıyım?",
    a: "Tek bir kanalla başla: public portal linki. Bir board aç, linki mevcut müşterilerine gönder ve 2–3 hafta boyunca gelen fikirlere yorum/oy eklemelerini teşvik et. Kanalları çoğaltmak, toplama alışkanlığı oturmadan gürültüyü artırır.",
  },
  {
    q: "Kaç geri bildirim yeterli?",
    a: "İlk karar için 20–30 anlamlı fikir genellikle yeter. Önemli olan adet değil, hangi müşteri segmentinden geldiği ve tekrar edip etmediğidir.",
  },
  {
    q: "Anonim mi, kayıtlı gönderim mi kullanmalıyım?",
    a: "İkisi farklı işler yapar. Anonim gönderim eşiği düşürür ve daha çok ham fikir getirir; kayıtlı mod kimi dinlediğini ve hangi segmentten geldiğini netleştirir. Kritik kararlar için kayıtlı modu, geniş tarama için anonim modu öneririz.",
  },
  {
    q: "Gelir skoru için veriyi elle mi girmem gerekiyor?",
    a: "Şirket ve MRR'ı elle ekleyebilir ya da CSV ile içe aktarabilirsin. Veri girilmedikçe skor yalnız oya dayanır — ürünün asıl farkı, oya müşteri ve fırsat ağırlığını eklediğinde ortaya çıkar.",
  },
  {
    q: "Geri bildirim verenlere nasıl haber vermeliyim?",
    a: "Bir fikri “yayında” durumuna aldığında oy veren ve takip eden herkese otomatik e-posta gider; ayrıca değişiklik günlüğüne düşer. Elle duyurmakla uğraşman gerekmez.",
  },
  {
    q: "Free planla nereye kadar yapabilirim?",
    a: "Toplama, oylama, AI etiketleme/özet/tekrar tespiti, yol haritası ve değişiklik günlüğü Free'de. Gelir skoru, entegrasyonlar, AI korpus içgörüleri, özel alan adı ve API/webhook Pro'ya geçince açılır.",
  },
];

// Müşteriye gönderilebilecek hazır davet metni (kopyalanabilir).
const INVITE_TEMPLATE = `Merhaba {{isim}},

Ürünümüzü senin geri bildiriminle şekillendiriyoruz. Fikirlerini,
sıkıldığın noktaları buraya bırakabilirsin:

{{portal linkin}}

En çok istediğin bir şeyi yaz, diğer müşterilerin oylarıyla birlikte
öncelik sıralamasında göreceksin. Bir şeyi yayına aldığımızda haber
vereceğiz.

Teşekkürler,
{{adın}}`;

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
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  // İçindekiler — uzun sayfada gezinme (bağlantılar gerçek bölümlere gider).
  const toc = [
    { href: "#adimlar", label: "7 adımda akış" },
    { href: "#neden-feedl", label: "Neden feedl?" },
    { href: "#karsilastirma", label: "Elle yapmakla karşılaştırma" },
    { href: "#kanal-secimi", label: "Hangi kanaldan toplamalı?" },
    { href: "#soru-tasarimi", label: "Ne sormalı, ne sormamalı?" },
    { href: "#baglam", label: "Hangi bağlamı kaydetmeli?" },
    { href: "#hatalar", label: "Sık yapılan 5 hata" },
    { href: "#olcum", label: "Ölçüm metrikleri" },
    { href: "#davet-metni", label: "Hazır davet metni" },
    { href: "#sss", label: "Sık sorulanlar" },
  ];

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

      {/* Neden zor? — rehberi "neden" üzerine kurar, ürün listesine değil. */}
      <section
        id="neden-zor"
        aria-labelledby="neden-zor-baslik"
        className="mx-auto mt-12 max-w-3xl rounded-2xl border bg-muted/30 p-6"
      >
        <h2 id="neden-zor-baslik" className="text-base font-semibold">
          Neden zor?
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              Geri bildirim dağınık: e-posta, destek bileti, Slack mesajı ve sözlü
              sohbet farklı yerlerde birikir ve hiçbiri birbirini görmez.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              “En çok oy alan” ile “en çok değer yaratan” aynı şey değildir; oy
              sayısı tek başına yön vermez.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              Verilen kararın gerekçesi kaybolur; aynı tartışma aylar sonra baştan
              başlar.
            </span>
          </li>
        </ul>
      </section>

      {/* İçindekiler */}
      <nav
        aria-label="İçindekiler"
        className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-card p-6"
      >
        <h2 className="text-base font-semibold">İçindekiler</h2>
        <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {toc.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
      <section id="adimlar" aria-labelledby="adimlar-baslik" className="scroll-mt-20">
        <h2
          id="adimlar-baslik"
          className="mx-auto mt-16 max-w-3xl text-2xl font-bold tracking-tight"
        >
          7 adımda akış
        </h2>
        <ol className="mx-auto mt-8 max-w-3xl space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-sm tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  {step.plan === "pro" ? <ProBadge /> : <FreeBadge />}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {step.details.map((detail) => (
                    <li key={detail} className="flex gap-2">
                      <span aria-hidden="true">–</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* "Neden feedl?" — rehberin kurduğu her problemle eşleşen çözüm.
          Sayfanın ticari işi de bu: sadece "nasıl yapılır" değil,
          "neden bunu bizimle yapmalısın" sorusunu cevaplar. */}
      <section id="neden-feedl" aria-labelledby="neden-feedl-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="neden-feedl-baslik" className="text-2xl font-bold tracking-tight">
          Neden feedl?
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Bu rehberdeki adımların çoğunu elle de yapabilirsin — ama her biri
          başka bir yerde kopuyor. Aşağıda her satır, yukarıda anlattığımız bir
          problemin karşılığıdır.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {WHY_FEEDL.map((item) => (
            <li key={item.problem} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{item.problem}</p>
                {item.plan === "pro" ? <ProBadge /> : <FreeBadge />}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.solution}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Ayrıca: ekip başına fiyatlandırma (kullanıcı başına değil), entegrasyonlar
          (Slack, Jira, Linear, Zendesk, Intercom), public API + webhook ve özel alan
          adı + marka kaldırma. Kurulum yok — tarayıcından çalışır.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button render={<Link href="/sign-up" />}>Ücretsiz Başla</Button>
          <Button variant="outline" render={<Link href="/demo" />}>
            Canlı Demoyu Gör
          </Button>
        </div>
      </section>

      {/* Karşılaştırma — kategoriler GENEL (marka adı yok); takaslar dürüstçe. */}
      <section id="karsilastirma" aria-labelledby="karsilastirma-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="karsilastirma-baslik" className="text-2xl font-bold tracking-tight">
          Elle yapmakla karşılaştırma
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          “Kendim yaparım” her zaman bir seçenek; maliyeti mühendislik zamanıdır.
          Aşağıdaki karşılaştırma hangi işin kimde kaldığını gösterir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Elle toplama, genel form aracı, kendi geliştirme ve feedl karşılaştırması
            </caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold">Kriter</th>
                <th scope="col" className="p-3 font-semibold">Elle (e-posta + tablo)</th>
                <th scope="col" className="p-3 font-semibold">Genel form aracı</th>
                <th scope="col" className="p-3 font-semibold">Kendin geliştir</th>
                <th scope="col" className="p-3 font-semibold">feedl</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.criterion} className="border-t align-top">
                  <th scope="row" className="p-3 font-medium">{row.criterion}</th>
                  <td className="p-3 text-muted-foreground">{row.manual}</td>
                  <td className="p-3 text-muted-foreground">{row.formTool}</td>
                  <td className="p-3 text-muted-foreground">{row.build}</td>
                  <td className="p-3 font-medium">{row.feedl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Kendi geliştirmenin karşılığı vardır: tam kontrol ve sıfır abonelik.
          İhtiyacın standart geri bildirim döngüsünün dışındaysa doğru seçim
          olabilir; sıradan bir döngüyü yeniden yazmak genelde zaman kaybıdır.
        </p>
      </section>
      {/* Kanal seçimi */}
      <section id="kanal-secimi" aria-labelledby="kanal-secimi-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="kanal-secimi-baslik" className="text-2xl font-bold tracking-tight">
          Hangi kanaldan toplamalı?
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Tek bir doğru kanal yok; doğru kombinasyon müşterinin seninle nerede
          karşılaştığına bağlı. Aşağıdaki tablo hangisinin ne zaman işe yaradığını
          özetler.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Geri bildirim toplama kanallarının karşılaştırması
            </caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold">Kanal</th>
                <th scope="col" className="p-3 font-semibold">Ne zaman</th>
                <th scope="col" className="p-3 font-semibold">Güçlü yanı</th>
                <th scope="col" className="p-3 font-semibold">Dikkat</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((c) => (
                <tr key={c.name} className="border-t align-top">
                  <th scope="row" className="p-3 font-medium">{c.name}</th>
                  <td className="p-3 text-muted-foreground">{c.when}</td>
                  <td className="p-3 text-muted-foreground">{c.good}</td>
                  <td className="p-3 text-muted-foreground">{c.watch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Soru tasarımı */}
      <section id="soru-tasarimi" aria-labelledby="soru-tasarimi-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="soru-tasarimi-baslik" className="text-2xl font-bold tracking-tight">
          Ne sormalı, ne sormamalı?
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Aynı müşteriden soruyu nasıl sorduğuna göre tamamen farklı bilgi
          alırsın. İyi soru problemi açığa çıkarır; kötü soru istediğin cevabı
          üretir.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-base font-semibold">İşe yarayan</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {QUESTION_DOS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-base font-semibold">Kaçın</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {QUESTION_DONTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Toplanacak bağlam */}
      <section id="baglam" aria-labelledby="baglam-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="baglam-baslik" className="text-2xl font-bold tracking-tight">
          Hangi bağlamı kaydetmeli?
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Metin tek başına zayıf sinyaldir. “Ne istediği”nin yanına “kim, nerede,
          hangi değerde” bilgisini koyduğunda fikir karşılaştırılabilir hale gelir.
          Widget ve portal bu alanların bir kısmını otomatik toplar.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {CONTEXT_FIELDS.map((item) => (
            <li key={item.field} className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold">{item.field}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Sık yapılan hatalar */}
      <section id="hatalar" aria-labelledby="hatalar-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="hatalar-baslik" className="text-2xl font-bold tracking-tight">
          Sık yapılan 5 hata
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {MISTAKES.map((m, i) => (
            <li key={m.title} className="rounded-2xl border bg-card p-5">
              <p className="flex items-start gap-3 text-sm font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs tabular-nums">
                  {i + 1}
                </span>
                {m.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ölçüm */}
      <section id="olcum" aria-labelledby="olcum-baslik" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
        <h2 id="olcum-baslik" className="text-2xl font-bold tracking-tight">
          Ölçüm metrikleri
        </h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Rehberin işe yaradığını tahminle değil sayıyla anlarsın. Bu beş metriği
          aylık olarak izlemek çoğu ekip için yeterlidir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Geri bildirim toplama akışının ölçüm metrikleri
            </caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold">Metrik</th>
                <th scope="col" className="p-3 font-semibold">Nasıl hesaplanır</th>
                <th scope="col" className="p-3 font-semibold">İyi işaret</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.name} className="border-t align-top">
                  <th scope="row" className="p-3 font-medium">{m.name}</th>
                  <td className="p-3 text-muted-foreground">{m.how}</td>
                  <td className="p-3 text-muted-foreground">{m.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hazır davet metni */}
      <section id="davet-metni" aria-labelledby="davet-metni-baslik" className="mx-auto mt-20 max-w-3xl scroll-mt-20">
        <h2 id="davet-metni-baslik" className="text-2xl font-bold tracking-tight">
          Hazır davet metni
        </h2>
        <p className="mt-3 text-muted-foreground">
          Aşağıdaki metni kopyalayıp müşterilerine gönderebilirsin;{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{...}}"}</code>{" "}
          alanlarını kendi bilgilerinle doldur. Kısa tutmak yanıt oranını artırır.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
          <code>{INVITE_TEMPLATE}</code>
        </pre>
      </section>

      {/* SSS */}
      <section id="sss" aria-labelledby="sss-baslik" className="mx-auto mt-20 max-w-3xl scroll-mt-20">
        <h2 id="sss-baslik" className="text-2xl font-bold tracking-tight">
          Sık sorulanlar
        </h2>
        <dl className="mt-6 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border bg-card p-5">
              <dt className="text-sm font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Kapanış CTA */}
      <section
        id="kapanis"
        aria-labelledby="kapanis-baslik"
        className="mx-auto mt-16 max-w-3xl rounded-2xl border bg-brand-soft p-8 text-center"
      >
        <h2 id="kapanis-baslik" className="text-2xl font-bold tracking-tight">
          İlk fikri birkaç dakikada topla
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Kurulum yok, kredi kartı yok. Free planla bugün başla; gelir verisini ve
          ekip araçlarını iş akışına katmak istediğinde Pro&apos;ya geç.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/sign-up" />}>Kayıt Ol</Button>
          <Button variant="outline" render={<Link href="/#pricing" />}>Fiyatlandırmayı Gör</Button>
        </div>
      </section>
    </main>
  );
}
