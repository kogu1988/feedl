import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FreeBadge, ProBadge } from "@/components/custom/pro";
import {
  ACCOUNT_PRO_NOTE,
  PLAN_POSITIONING,
  TRIAL_VS_WITHDRAWAL_NOTE,
} from "@/lib/plan-copy";
import { generateCanonical } from "@/lib/seo";

// SEO + ürün-içi rehber: "feedl nasıl kullanılır". Bu sayfa, kavramsal
// "müşteri geri bildirimi nasıl toplanır" rehberinden (how-to-collect-feedback)
// AYRI bir niyeti hedefler: kullanıcının platformda hangi ekrana gidip ne
// yapacağını, gerçek ekran adları ve akışlarıyla adım adım anlatır.
//
// Neden ayrı sayfa: iki içerik farklı arama niyeti taşır ("nasıl toplarım" vs
// "feedl nasıl kullanılır") ve farklı okuyucuya konuşur. Aynı sayfaya
// sıkıştırmak her iki niyeti de zayıflatırdı.
//
// Dil kuralları (README söz dağarcığı): rakip marka adı YOK, abartılı/kanıtsız
// iddia YOK, takaslar dürüstçe yazılır. Plan dili TEK kaynaktan gelir
// (lib/plan-copy.ts → PLAN_POSITIONING / ACCOUNT_PRO_NOTE /
// TRIAL_VS_WITHDRAWAL_NOTE); böylece farklı yüzeyler aynı ürün gerçekliğini
// farklı anlatmaz.
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "feedl nasıl kullanılır — uçtan uca ürün rehberi",
    description:
      "Çalışma alanı açmaktan widget'ı sitene bağlamaya, AI analizinden yol haritasına kadar feedl'i baştan sona kur. Gerçek ekran adları, adım adım widget kurulumu ve Free/Pro plan farkları.",
    ...canonical,
  };
}

type Plan = "free" | "pro";
type Step = { title: string; text: string; plan?: Plan };
type Section = { id: string; title: string; summary: string; steps: Step[] };

// ── Kurulum akışı — doğrusal yol (numbered <ol> hakkı verir) ────────────────
const SETUP_FLOW = [
  { title: "Çalışma alanı", text: "Kayıt ol, adı ve marka rengini seç." },
  { title: "Board", text: "Fikirlerin toplanacağı kutuyu aç." },
  { title: "Toplama", text: "Portal linkini paylaş ya da widget'ı sitene göm." },
  { title: "AI analizi", text: "Etiket, özet ve benzer istek tespiti." },
  { title: "Öncelik", text: "Gelir bağlamıyla skorla (Pro)." },
  { title: "Yol haritası", text: "Kararı taşı ve duyur." },
];

// ── Bölümler — her biri gerçek bir ekran/akışı anlatır ─────────────────────
const SECTIONS: Section[] = [
  {
    id: "workspace",
    title: "1. Hesap ve çalışma alanı",
    summary:
      "Her şey bir çalışma alanıyla başlar: portalın, board'larının ve ekibinin yaşadığı yer.",
    steps: [
      {
        title: "Kayıt ol ve çalışma alanını adlandır",
        text: "Kayıt olduktan sonra kurulum sihirbazı (onboarding) çalışma alanı adını ve marka rengini ister. Yazdığın ad, alt alan adının (subdomain) canlı önizlemesini anında gösterir.",
      },
      {
        title: "Çalışma alanı varsayılan olarak örnek veriyle açılır",
        text: "Kurulumda “örnek verilerle göster” açıktır; panonu dolu görüp tüm akışı gerçek veri toplamadan inceleyebilirsin. Örnekler mock'tur, gerçek müşteri verisi değildir.",
      },
      {
        title: "Örnek veriyi istediğin an kaldır",
        text: "Çalışma Alanları sayfasındaki “Veri ve gizlilik” bölümünden “Örnek verileri kaldır” ile tek tıkla temizle. Sonrasında portalın temiz bir sayfa olarak başlar.",
      },
      {
        title: "İkinci bir çalışma alanı aç (Pro)",
        text: "Çalışma Alanları sayfasından yeni bir alan ekleyebilirsin. Free hesap 1 alanla sınırlıdır; Pro sınırsız alan açar. Aynı hesapta owner olduğun tüm alanlar Pro'dan yararlanır.",
        plan: "pro",
      },
    ],
  },
  {
    id: "board",
    title: "2. İlk board'unu oluştur",
    summary:
      "Board, fikirlerin toplandığı temel kutudur. Tek board ile başla; ihtiyaç büyüdükçe ayır.",
    steps: [
      {
        title: "Board'lar sayfasından yeni board ekle",
        text: "Board'lar ekranındaki ekleme formundan ad ve adres (slug) verirsin. Kurulumda “Genel” adlı bir board otomatik açılır; portalın kökünde bu board görünür.",
      },
      {
        title: "Görünürlüğü seç: public ya da gizli",
        text: "Public board portalda herkese görünür ve oylanabilir. Gizli board portalda görünmez; yalnızca ekibin içinden beslenen konular için uygundur.",
        plan: "pro",
      },
      {
        title: "Fikirleri anlamlı böl",
        text: "“Özellik istekleri”, “Hata bildirimleri”, “Entegrasyon istekleri” gibi ayrı board'lar, hem portalı düzenli tutar hem de AI analizini daha isabetli yapar.",
      },
    ],
  },
  {
    id: "toplama",
    title: "3. Fikirleri topla: portal ve widget",
    summary:
      "İki ana toplama yüzeyi var: paylaşılabilir portal linki ve sitene gömülen widget. İkisini birlikte kullanabilirsin.",
    steps: [
      {
        title: "Portal linkini paylaş",
        text: "Çalışma alanının alt alan adı (ör. ornek.feedl.app) doğrudan müşteri portalıdır. Linki e-postaya, dokümana veya ürün içi bir bağlantıya koy; müşteri hesap açmadan fikir gönderip oy verebilir (gönderim moduna göre).",
      },
      {
        title: "Gönderim modunu seç",
        text: "Çalışma Alanları → Widget fikir gönderimi bölümünde üç mod var: Anonim (üye olmadan fikir + oy), E-posta (yalnızca mail adresi istenir) ve Kayıt zorunlu (kurum içi toplama için). Anonim modda oylamaya ayrıca izin verebilirsin.",
      },
      {
        title: "Widget'ı ürününün içine göm",
        text: "Widget, kullanıcı sorunu tam o an yaşarken geri bildirim verir; sayfa adresi, cihaz ve tarayıcı bilgisi otomatik kaydedilir. Kurulumu bir sonraki bölümde.",
      },
    ],
  },
  {
    id: "widget",
    title: "4. Widget'ı kur ve sitene bağla",
    summary:
      "Widget kurulumu altı adımdır ve tamamı Dashboard → Widget ekranında yapılır. İzinli site eklenmezse istekler reddedilir.",
    steps: [
      {
        title: "1) Widget ekranını aç",
        text: "Dashboard menüsündeki Widget sayfası, “Kurulum” ve “İzinli siteler” olmak üzere iki karttan oluşur. Bu sayfa yalnızca yöneticilere görünür.",
      },
      {
        title: "2) Test için bir jeton üret",
        text: "Kurulum kartındaki “Jeton Üret (1 saatlik)” ile bir test jetonu al. Kimlik alanı yalnızca harf, rakam, - ve _ kabul eder. Bu jeton yalnızca denemek içindir; üretimde jetonu kendi sunucun imzalar (6. adım).",
      },
      {
        title: "3) İzinli siteyi (origin) ekle",
        text: "“İzinli siteler” kartına widget'ı gömeceğin sitenin adresini ekle — yol içermeyen tam adres yeter (ör. https://siteniz.com). Listede olmayan bir origin'den gelen istekler 403 ile reddedilir; widget'ın görünmemesinin en sık nedeni budur.",
      },
      {
        title: "4) Görünümü ayarla",
        text: "Vurgu rengi launcher butonuna uygulanır: Free planda feedl marka rengidir ve panelde feedl rozeti görünür; özel renk ve rozetin kaldırılması Pro'dadır. İşaret rengi (görsel geri bildirimde vurgu halkası) her planda ayarlanabilir — sitenin rengiyle görünür bir ton seç. Tema açık, koyu veya sisteme göre seçilir.",
        plan: "pro",
      },
      {
        title: "5) Snippet'i kopyala ve sitene ekle",
        text: "Kurulum kartının son adımı, ayarlarına göre doldurulmuş script etiketini üretir. Kopyalayıp sayfanın gövdesine (</body> öncesi) ekle. Jeton gömülüyse ziyaretçi kimliğiyle fikir gönderip oy verir; jetonsuz açılırsa salt-okunur liste gösterir.",
      },
      {
        title: "6) Üretimde jetonu kendi backend'inde imzala",
        text: "Gerçek kullanıcını göstermek için widget ekranındaki “Üretim” bölümündeki HS256 örneğini kullan. Jeton, paylaşılan FEEDL_WIDGET_SECRET ile sunucunda imzalanır — gizli anahtarı istemciye asla koyma. Jetonun süresi dolduğunda oturum kapanır; kullanıcı yine salt-okunur listeyi görür.",
      },
    ],
  },
  {
    id: "ai",
    title: "5. AI analizini kur ve düzelt",
    summary:
      "Her yeni fikir otomatik işaretlenir; amaç insanı tekrarlayan işten kurtarmak, kararı insanda bırakmak.",
    steps: [
      {
        title: "Otomatik etiketleme, özet ve duygu",
        text: "Her fikir türüne (hata, istek, soru), önceliğine ve konusuna göre etiketlenir; içeriği tek cümlede özetlenir. Bu, Free planda da çalışır.",
      },
      {
        title: "Benzer istek tespiti",
        text: "Aynı ihtiyacı onlarca kişi ayrı ayrı yazabilir. Benzerlik tespiti bunları işaretler ki tüm talebi tek fikirde görebilesin.",
      },
      {
        title: "AI yanılırsa düzelt",
        text: "Bir fikri “ilgisiz” işaretlemek veya türünü değiştirmek sonraki sınıflandırmayı yönlendirir. AI önerir; nihai karar her zaman sende kalır.",
      },
      {
        title: "AI içgörüleri (korpus analizi)",
        text: "AI İçgörüleri ekranı, tek tek fikirleri değil tüm geri bildirim havuzunu analiz eder: temalar, trendler, riskler ve fırsatlar. Bu plan Pro'dur.",
        plan: "pro",
      },
    ],
  },
  {
    id: "gelir",
    title: "6. Gelir bağlamı ve önceliklendirme",
    summary:
      "“En çok oy alan” ile “en çok değer yaratan” aynı şey değildir. Gelir bağlamı, sıralamayı iş kararına bağlar.",
    steps: [
      {
        title: "Şirketleri kaydet",
        text: "Şirketler ekranından müşterilerini ekle (elle veya CSV ile). Şirket ve üye yönetimi Free planda açıktır; geri bildirimi kimin verdiğini bilmek her planda değerlidir.",
      },
      {
        title: "MRR gir",
        text: "Şirkete aylık yinelenen gelir (MRR) değeri eklemek Pro'dadır; gelir skorunun ana girdisidir. Free'de MRR alanı kapalıdır ve mevcut değer silinmez.",
        plan: "pro",
      },
      {
        title: "Fırsatları ekle",
        text: "Kapalı kazanç (won) ve açık fırsat (pipeline) kayıtları, bekleyen geliri skora katar. Fırsat yönetimi Pro'dadır.",
        plan: "pro",
      },
      {
        title: "Gelir skorunu oku",
        text: "Gelir ekranı ve dashboard'daki skor sütunu her isteği oy + müşteri sayısı + fırsat (MRR) ile sıralar. Skor bir kara kutu değildir: fikrin detayında “bu skor nasıl hesaplandı?” dökümünü görürsün.",
        plan: "pro",
      },
    ],
  },
  {
    id: "roadmap",
    title: "7. Yol haritası ve duyuru",
    summary:
      "Kararı verilen iş yol haritasına taşınır; yayına alınınca geri bildirim verenler otomatik haberdar olur.",
    steps: [
      {
        title: "Durumu değiştir, yol haritasına taşı",
        text: "Bir fikrin durumunu “planlandı”, “geliştiriliyor”, “yayında” gibi aşamalara al. Durum değiştiğinde iç not otomatik düşer; ekibin neden o kararı verdiği kayıtlı kalır.",
      },
      {
        title: "Otomatik bildirim gider",
        text: "İş yayına alındığında oy veren ve takip eden herkese e-posta gider. Geri bildirim veren, emeğinin karşılığını görür — döngü kapanır ve tekrar geri bildirim verir.",
      },
      {
        title: "Değişiklik günlüğüne düşer",
        text: "Yayınlanan her özellik güncellemeler (changelog) sayfasına eklenir; müşteriler abone olup takip edebilir. Aynı içerik portalda da görünür.",
      },
    ],
  },
  {
    id: "ekip",
    title: "8. Ekip ve roller",
    summary:
      "Üç rol kademesi var. Amaç en az yetkiyle işi yürütmek: owner kararı verir, ekip uygular.",
    steps: [
      {
        title: "Owner — hesabın sahibi",
        text: "Faturalama, çalışma alanı silme ve tüm ayarlar owner'dadır. Kurulumu yapan kişi otomatik owner olur; bir hesapta birden fazla owner bulunabilir.",
      },
      {
        title: "Manager — ürün operasyonu",
        text: "Board, fikir, yol haritası ve üye yönetimini yürütür; faturalamaya erişemez. Owner'ın kararlarını uygulayan kademedir.",
      },
      {
        title: "Member — katkı",
        text: "Ürün operasyonuna katkı verir (fikir, yorum, durum) ama üye ve faturalama yönetimine dokunmaz. Gizli board ve gelir verisi owner/manager kararıdır.",
      },
      {
        title: "Üye davet et",
        text: "Üyeler ekranından e-posta ile davet gönderirsin; davet linki oturumsuz da açılır. Free plan 1 üye ile sınırlıdır; Pro 10 üyeye kadar ekler.",
        plan: "pro",
      },
      {
        title: "Portal kullanıcısı (üyelik gerekmez)",
        text: "Fikir gönderen ve oy veren müşteri bir “üye” değildir: hesap açması gerekmez. Üye, senin ekibindir; portal kullanıcısı geri bildirimi verendir.",
      },
    ],
  },
  {
    id: "entegrasyon",
    title: "9. Mevcut iş akışına bağla",
    summary:
      "Geri bildirim ayrı bir yerde durmasın; ekip zaten kullandığı araçlarda görsün.",
    steps: [
      {
        title: "Mesaj ve destek kanalları",
        text: "Slack mesajları ile Zendesk ve Intercom konuşmalarını otomatik olarak fikre dönüştür. Böylece destek ekibinin gördüğü problem ürün panosuna düşer.",
        plan: "pro",
      },
      {
        title: "Proje araçları",
        text: "Jira ve Linear entegrasyonları ile fikri tek tıkla geliştirme işine dönüştür; durum değişimleri iki tarafta senkron kalır.",
        plan: "pro",
      },
      {
        title: "Public API ve webhook",
        text: "Kendi panelinde rapor üretmek veya otomasyonuna bağlamak için API anahtarı oluştur, webhook uçlarını tanımla. Gelen olaylar imzalanır; uç noktanı imzayla doğrula.",
        plan: "pro",
      },
      {
        title: "CSV içe ve dışa aktarım",
        text: "Mevcut şirket ve geri bildirim listenizi CSV ile taşıyabilir, panoyu dışa aktarabilirsin. CSV işlemleri Pro'dadır.",
        plan: "pro",
      },
    ],
  },
  {
    id: "faturalama",
    title: "10. Plan ve faturalama",
    summary:
      "Free ile ürünün temel döngüsünü denersin; Pro ile iş akışına ve gelir verisine bağlarsın.",
    steps: [
      {
        title: "Planı yönet",
        text: "Faturalama ekranından planı yükselt, kartı güncelle veya iptal et. İptal, mevcut fatura döneminin sonunda yürürlüğe girer ve otomatik iade anlamına gelmez. Bu ekran yalnızca owner'a görünür.",
      },
      {
        title: "Ücretsiz denemeyi doğru anla",
        text: "Ücretsiz deneme süresi satın alma ekranında açıkça gösterilir; İade Politikası'ndaki iade penceresi ve yasal cayma hakkı ayrı kavramlardır.",
      },
      {
        title: "Hesap düzeyi Pro",
        text: ACCOUNT_PRO_NOTE,
        plan: "pro",
      },
    ],
  },
];

// ── Plan karşılaştırması — tek bakışta sınırlar ────────────────────────────
const PLAN_MATRIX: Array<{ feature: string; free: string; pro: string }> = [
  { feature: "Çalışma alanı", free: "1", pro: "Sınırsız" },
  { feature: "Board", free: "1", pro: "Sınırsız" },
  { feature: "Ekip üyesi", free: "1", pro: "10" },
  { feature: "Takipçi", free: "50", pro: "Sınırsız" },
  { feature: "Fikir, oy, yorum", free: "Var", pro: "Var" },
  { feature: "AI etiketleme, özet, tekrar tespiti", free: "Var", pro: "Var" },
  { feature: "Yol haritası ve değişiklik günlüğü", free: "Var", pro: "Var" },
  { feature: "Toplu aksiyonlar ve kayıtlı görünümler", free: "Var", pro: "Var" },
  { feature: "Widget", free: "Var", pro: "Var" },
  { feature: "Gizli (private) board", free: "Yok", pro: "Var" },
  { feature: "Gelir skoru ve MRR / fırsat girişi", free: "Yok", pro: "Var" },
  { feature: "AI içgörüleri (korpus analizi)", free: "Yok", pro: "Var" },
  { feature: "Entegrasyonlar (Slack, Jira, Linear, Zendesk, Intercom)", free: "Yok", pro: "Var" },
  { feature: "Public API, webhook ve CSV", free: "Yok", pro: "Var" },
  { feature: "Özel alan adı ve marka kaldırma", free: "Yok", pro: "Var" },
];

const FAQ = [
  {
    q: "Widget'ım sayfada görünmüyor, neden?",
    a: "En sık iki neden var: sitenin origin'i “İzinli siteler” listesinde yok (istekler 403 ile reddedilir) ya da snippet eklenmemiş/silinmiş. Önce Dashboard → Widget → İzinli siteler kartına https://siteniz.com biçiminde adresi ekle, sonra script etiketini sayfanın gövdesine koy.",
  },
  {
    q: "Widget'ı birden fazla sitede kullanabilir miyim?",
    a: "Evet. Her site için ayrı bir izinli origin ekle. Aynı çalışma alanının widget'ı tüm izinli origin'lerden aynı panoya besler.",
  },
  {
    q: "Free planda sınırlar neler?",
    a: "1 çalışma alanı, 1 board, 1 ekip üyesi ve 50 takipçi. Fikir, oy, yorum, AI etiketleme/özet, yol haritası, değişiklik günlüğü, toplu aksiyonlar ve widget Free'de açıktır. Gelir skoru, gizli board, entegrasyonlar, API/webhook ve özel alan adı Pro'dadır.",
  },
  {
    q: "Müşteri hesap açmadan geri bildirim verebilir mi?",
    a: "Evet. Çalışma Alanları ekranındaki gönderim modunu “Anonim” yaparsan ziyaretçi üye olmadan fikir gönderir ve (izin verirsen) oy verir. “E-posta” modunda yalnızca mail adresi istenir; “Kayıt” modu kurum içi toplama için uygundur.",
  },
  {
    q: "Gelir skorum neden 0 görünüyor?",
    a: "İki olası neden: gelir verisi (şirket MRR'ı ve fırsatlar) henüz girilmemiş ya da plan Free. Gelir girişi ve gelir skoru Pro özelliğidir; şirketleri ve MRR değerlerini Şirketler ekranından ekleyerek başla.",
  },
  {
    q: "Özel alan adı nasıl bağlanır?",
    a: "Pro planda Çalışma Alanları ekranından alan adını ekle, sana gösterilen DNS kayıtlarını kendi alan adı sağlayıcında tanımla ve doğrulamayı başlat. Doğrulanan adres portalın ve widget'ının kanonik adresi olur.",
  },
  {
    q: "Örnek verileri nasıl silerim?",
    a: "Çalışma Alanları sayfasındaki “Veri ve gizlilik” bölümünden “Örnek verileri kaldır” ile silinir. Gerçek verilerin etkilenmez.",
  },
];

const WIDGET_SNIPPET = `<script
  src="https://feedl.app/widget.js"
  data-feedl-url="https://feedl.app"
  data-token="..."            <!-- opsiyonel; yoksa salt-okunur liste -->
  data-button-text="Geri bildirim"
  data-accent="#ff5c35"       <!-- yalnızca Pro -->
  data-mark-color="#ff5c35"   <!-- görsel geri bildirim işaret rengi -->
  data-theme="auto"           <!-- light | dark | auto -->
></script>`;

export default function HowToUseFeedlPage() {
  const base = "https://feedl.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "feedl nasıl kullanılır",
        description:
          "Çalışma alanı açmaktan widget kurulumuna kadar feedl'in uçtan uca ürün rehberi.",
        url: `${base}/how-to-use-feedl`,
        step: SETUP_FLOW.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.title,
          text: step.text,
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

  const toc = [
    { href: "#akis", label: "Kurulum akışı" },
    ...SECTIONS.map((section) => ({
      href: `#${section.id}`,
      label: section.title,
    })),
    { href: "#planlar", label: "Free / Pro karşılaştırması" },
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
          feedl nasıl kullanılır — uçtan uca rehber
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Çalışma alanı açmaktan widget&apos;ı sitene bağlamaya, AI analizinden yol
          haritasına kadar tüm akış burada. Her bölüm gerçek bir ekrana karşılık
          gelir; hangi planda yapılabildiği rozetle işaretlidir.
        </p>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {PLAN_POSITIONING.free} {PLAN_POSITIONING.pro}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button render={<Link href="/sign-up" />}>Ücretsiz Başla</Button>
          <Button variant="outline" render={<Link href="/demo" />}>
            Canlı Demoyu Gör
          </Button>
        </div>
      </div>

      {/* Kurulum akışı — doğrusal gerçek sıra → numbered <ol>. */}
      <section id="akis" className="mx-auto mt-12 max-w-3xl scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">
          Kurulum akışı — altı adımda
        </h2>
        <p className="mt-3 text-muted-foreground">
          İlk günden çalışan bir döngü için izlenecek yol. Ayrıntılar aşağıdaki
          bölümlerde.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {SETUP_FLOW.map((item, i) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border bg-card p-4"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
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

      {/* Bölümler */}
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="mx-auto mt-20 max-w-3xl scroll-mt-20"
        >
          <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
          <p className="mt-3 text-muted-foreground">{section.summary}</p>
          <ul className="mt-6 space-y-4">
            {section.steps.map((step) => (
              <li key={step.title} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  {step.plan === "pro" ? (
                    <ProBadge />
                  ) : step.plan === "free" ? (
                    <FreeBadge />
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Widget snippet — gerçek kullanım örneği */}
      <section className="mx-auto mt-20 max-w-3xl scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Widget snippet örneği</h2>
        <p className="mt-3 text-muted-foreground">
          Widget ekranı bu etiketi senin ayarlarına göre doldurur. Aşağıdaki,
          seçeneklerin ne anlama geldiğini gösteren bir örnektir.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl border bg-muted/40 p-5 text-xs leading-relaxed text-muted-foreground">
          {WIDGET_SNIPPET}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">data-token</code>{" "}
          opsiyoneldir; yoksa widget salt-okunur liste olarak açılır.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">data-accent</code>{" "}
          yalnızca Pro&apos;da yazılır (Free&apos;de feedl marka rengi geçerlidir).
        </p>
      </section>

      {/* Plan karşılaştırması */}
      <section id="planlar" className="mx-auto mt-20 max-w-3xl scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">
          Free / Pro karşılaştırması
        </h2>
        <p className="mt-3 text-muted-foreground">
          Free, ürünün temel döngüsünü denemen içindir; Pro, iş akışına ve gelir
          verisine bağlanmak içindir. Aşağıdaki tablo sınırları tek bakışta
          gösterir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              feedl Free ve Pro plan karşılaştırması
            </caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold">Özellik</th>
                <th scope="col" className="p-3 font-semibold">Free</th>
                <th scope="col" className="p-3 font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_MATRIX.map((row) => (
                <tr key={row.feature} className="border-t align-top">
                  <th scope="row" className="p-3 font-medium">{row.feature}</th>
                  <td className="p-3 text-muted-foreground">{row.free}</td>
                  <td className="p-3 text-muted-foreground">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {TRIAL_VS_WITHDRAWAL_NOTE}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button render={<Link href="/#pricing" />}>Fiyatlandırmayı Gör</Button>
          <Button variant="outline" render={<Link href="/how-to-collect-feedback" />}>
            Geri Bildirim Rehberi
          </Button>
        </div>
      </section>

      {/* SSS */}
      <section id="sss" className="mx-auto mt-20 max-w-3xl scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Sık sorulanlar</h2>
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
      <section className="mx-auto mt-16 max-w-3xl rounded-2xl border bg-brand-soft p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          İlk fikri birkaç dakikada topla
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Kurulum yok, kredi kartı yok. Free planla bugün başla; gelir verisini ve
          ekip araçlarını iş akışına katmak istediğinde Pro&apos;ya geç.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/sign-up" />}>Kayıt Ol</Button>
          <Button variant="outline" render={<Link href="/contact" />}>
            İletişime Geç
          </Button>
        </div>
      </section>
    </main>
  );
}
