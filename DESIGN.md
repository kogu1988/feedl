# feedl — Tasarım Referansı

> Sprint 35–36'da tanımlanan tasarım dilinin tek kaynağı. Yeni bileşen,
> ekran veya UI değişikliği yaparken önce bu dosyaya bak; kuralda değişiklik
> gerekirse önce buranın güncellenmesi, sonra koda yansıtılması gerekir.
> Renk ve tipografi değerleri `app/globals.css` içindeki gerçek token'lardan
> birebir alınmıştır; kod eşleşmezse kod gerçek kaynaktır.
> 2026-09-05 revizyonu: yapısal slate sidebar, hibrit kabuk, hareket
> disiplini ve tipografi ölçeği eklendi (karar süreci:
> `docs/design_report.md`).

## 1. Tasarım İlkesi

- Kategori rakipleri (Canny, Frill, Nolt, Featurebase, UserJot) mavi/mor
  denizinde — **mercan tek marka aksanı ile ayrışma**.
- **Tek aksan disiplini:** Mercan markaya aittir; mor, mavi, yeşil vb.
  renkler yalnızca durum/duygu rozetlerinde anlamsal olarak kullanılır.
- Ton: "geri bildirim = insan sesi". Arayüz metni sade Türkçe, aktif ses,
  söz değil eylem ("Kaydet", yayınlandığında "Yayınlandı").
- Mercan zemin üzerine **beyaz değil koyu mürekkep** — white-on-coral
  3.1:1 (AA başarısız), ink-on-coral 5.9:1 ✓.
- **Renk bütçesi 90/5/5:** ~%90 nötrler (zemin/kart/border/metin), ~%5
  anlamsal rozetler, ~%5 mercan. Mercan yalnız **eylemde** görünür
  (buton, oy, odak, aktif durum) — asla dekorda veya başlık vurgusunda.
- **Gölge = yükseklik, dekor değil.** Statik kart gölgesizdir; gölge
  yalnız yüzen katmanı ve hover kaldırmasını anlatır (bkz. §5).

## 2. Renk Sistemi

### Marka aksanı (globals.css `:root` / `.dark`)

| Token | Açık | Koyu | Kullanım |
|-------|------|------|----------|
| `--brand` | `#ff5c35` | `#ff5c35` | Tek aksan — `bg-brand`, `text-brand`, aktif durumlar |
| `--brand-strong` | `#c7360f` | `#ff8c66` | Açık zeminde metin/hover (AA), koyu zeminde parlak ton |
| `--brand-soft` | `#ffe8df` | `rgb(255 92 53 / 14%)` | Yumuşak mercan zemin |
| `--brand-tint` | `#fff5f1` | `rgb(255 92 53 / 8%)` | En hafif zemin vurgusu |

- `--primary` = `--brand`; **`--primary-foreground` = `#2b0e04`** (her iki
  modda aynı koyu mürekkep; değiştirilmez).
- `--ring` = `#ff8c66` (her iki modda — odak halkası da mercan).
- Nötrler shadcn varsayılanı (oklch); koyu modda `--background` 0.145,
  `--card` / `--popover` 0.205 (sidebar hariç — aşağıda yapısal slate).
- `@theme inline` ile `bg-brand`, `text-brand-soft`, `border-brand` vb.
  utility'ler açıldı. `--radius` tabanı `0.625rem`; `radius-sm`..`radius-4xl`
  türetilmiş.

### Anlamsal renkler (sadece bu rozetlerde, DEĞİŞTİRİLMEZ)

- **StatusBadge** (`components/custom/status-badge.tsx` — tek görsel kaynak):
  Açık nötr · İncelemede menekşe · Planlandı sky · Geliştiriliyor amber ·
  Yayınlandı emerald · Kapatıldı nötr + üstü çizili.
- **Roadmap kolon noktaları** (`app/(main)/roadmap/page.tsx`
  `columnDotStyles`): planned `sky-500`, in-progress `amber-500`,
  shipped `emerald-500` — StatusBadge ile aynı dil.
- **SentimentBadge** (`components/custom/sentiment-badge.tsx`): pozitif
  emerald, nötr nötr, negatif rose.
- Destructive (kırmızı) mercanla aynı sıcak ailede — karıştırma; canlıda
  sorun olursa derinleştirilecek ama başka renkle değiştirilmez.
- **Amber kapsamı (2026-09-05 daraltma):** amber yalnız "dikkat"
  semantiği taşır — Geliştiriliyor rozeti + kolon noktası, dahili
  (yalnızca ekip) yorum notu, gizli anahtar/webhook uyarıları, inceleme
  bekleyen durumlar. Bilgilendirme notları (ör. "X ile birleştirildi")
  nötr temada (border + muted) gösterilir; amber dekoratif/asimetrik
  kullanılmaz.

### Yapısal nötr — admin sidebar yüzeyi (2026-09-05, nötrleştirme 2026-09-06)

Aksan değil **nötr yapı**: yalnız admin sidebar zemininde. İlk karar Tailwind
slate (lacivertimsi, chroma 0.042) idi; 2026-09-06'da lacivert kaydığını ve
marka aksanıyla karıştığını fark edip **gerçek nötr grafite** (chroma 0)
cekildi. `--sidebar-*` tokenları bu değerleri taşır (`app/globals.css`).

| Token | Açık mod | Koyu mod | Kullanım |
|-------|----------|----------|----------|
| `--sidebar` | `oklch(0.216 0 0)` | `oklch(0.145 0 0)` | Kabuk zemini (nötr grafit) |
| `--sidebar-foreground` | `oklch(0.968 0 0)` | aynı | Metin |
| `--sidebar-primary` | `var(--brand)` | `var(--brand)` | Aktif nav — mercan, eylem rengi |
| `--sidebar-primary-foreground` | `#2b0e04` | `#2b0e04` | Mürekkep — kural 2 geçerli |
| `--sidebar-accent` | `oklch(0.269 0 0)` | `oklch(0.215 0 0)` | Hover yüzeyi |
| `--sidebar-border` | `oklch(1 0 0 / 8%)` | `oklch(1 0 0 / 10%)` | Ayırıcılar |

Nötr içerik alanına, butonlara, rozetlere sızmaz; yalnız sidebar kabuğuyla
sınırlıdır. Renk tonu (hue) tamamen kaldırıldığı için marka mercanıyla
çakışmaz.

## 3. Tipografi

- **Metin + başlık:** Manrope (latin + latin-ext, Türkçe destekli) —
  `--font-app-sans`, `html` üzerinde `font-sans`.
- **Sayılar/veri:** Geist Mono — `font-mono` (dashboard istatistikleri,
  sayaçlar, tablo sayıları).
- Başlıklar h1–h4: `letter-spacing: -0.02em` (globals.css `@layer base`).
- E-posta şablonları **sistem fontu** — kasıtlı, dokunma.
- **Ölçek (2026-09-05):** display `text-4xl/5xl` (yalnız landing hero) →
  h1 `text-2xl bold tracking-tight` → h2 `text-base semibold` (bölüm) →
  gövde `text-sm` → meta/caption `text-xs text-muted-foreground`. KPI
  sayıları: `font-mono text-3xl tabular-nums`. Landing bölüm h2:
  `text-2xl bold tracking-tight` (marketing yüzeyi, app'ten büyük);
  mock kart oy/yorum sayaçları `font-mono tabular-nums`.
- Prose satır uzunluğu **<80ch** (`max-w-prose` / `max-w-3xl`).
- Her sayfada **tek `h1`**; sayfa başlığı asla `CardTitle` (div)
  olarak yazılmaz — kart başlıkları `CardTitle` kalır, sayfa başlığı
  gerçek `h1` elemanıdır (portal fikir detayı düzeltmesi, 2026-09-05).
- Yasak tell'ler: ALL-CAPS eyebrow etiketi, başlıkta tek kelimeyi
  renkli/italik vurgulama, dekoratif mono mini-etiket.

## 4. Kabuk ve Yerleşim

**Hibrit kabuk (2026-09-05 kararı; batch 2'de uygulandı):** public
yüzeyler (portal, roadmap, changelog, landing) üst bar + footer düzeninde
kalır; **yalnız admin `/dashboard`** 240px daralabilir sidebar alır
(56px ikon rayına iner; mobilde çekmece). Sidebar nav gerçek route setiyle
3 grup: Genel (Genel Bakış / Board'lar / Gelir), Yönetim (Şirketler /
Üyeler / Alanlar / Çalışma Alanları), Sistem (Widget / Faturalama /
Ayarlar). Hesap erişimi (UserButton) sidebar'ın dibinde DEĞİL, üst bardadır
(2026-09-10: alttaki yinelenen "Hesap" bölümü kaldırıldı — masaüstünde header
sağında, mobilde header hamburger menüsünde). Bileşen: `app-sidebar` —
dashboard altı `layout.tsx` sağlar; rail durumu localStorage.

**Sidebar rol kademesi (3 kademe, 2026-09-11):**
`workspace_members.role` → owner (her şey; faturalama + workspace silme +
owner devri), manager (ürün ops + üye yönetimi), member (ürün ops). Üyeliği
olmayan = portal son kullanıcısı ("user"; saklanan rol değil). `adminOnly`
öğeler (Gelir / Üyeler / Çalışma Alanları / Widget / Entegrasyonlar)
owner+manager'a görünür; `ownerOnly` (Faturalama) yalnız owner'a. Member'ın nav
listesi Genel Bakış / Board'lar / Aktivasyon / AI İçgörüleri / Şirketler /
Alanlar olur. `layout.tsx` `getDashboardScope()` ile
`scope="owner|admin|team"` prop'unu `AppSidebar`'a geçirir.

- `app/(main)/layout.tsx`: `ClerkProvider(appearance: variables/elements)` > `ThemeProvider` >
  `flex min-h-svh flex-col` (üst bar / flex-1 içerik / alt bar).
- **Üst bar** (`components/custom/site-header.tsx`): `h-14`,
  `sticky top-0 z-40 bg-background`; container **her sayfada tam genişlik**
  (`max-w-none`); marka karosu (`size-6 rounded-md bg-brand` + ChevronsUpIcon
  koyu mürekkep), aktif nav vurgusu `bg-muted`; sağda `ThemeToggle` +
  Clerk butonları. **Satış/marka yüzeyi** (`/`, `/demo`, `/pricing`, `/contact`,
  `/privacy`, `/terms`) → Demo+Fiyat; **admin** (`/dashboard*`) → yalnız
  "Portal" (public board'a atla; sidebar zaten nav); **auth/işlem**
  (`/sign-in`, `/sign-up`, `/onboarding`, `/invites`) → nav YOK;
  **public topluluk** (`/portal*`, `/roadmap*`, `/changelog*`) →
  Portal+Yol+Güncellemeler.
- **Alt bar** (`components/custom/site-footer.tsx`): `border-t` + marka
  cümlesi + linkler; **yüzeye göre** — satış/marka sayfasında "Ürün" kolonu
  Demo+Fiyat, public toplulukta Portal/Yol/Güncellemeler; admin ve auth
  yüzeylerinde footer render edilmez (marka/legal sayfaları public kalır).
- **Marketing h1 merdiveni (2026-09-05):** landing hero `text-4xl
  sm:text-5xl lg:text-6xl`; demo/pricing h1 `text-3xl sm:text-4xl`;
  bölüm h2'leri `text-2xl` — yalnız ana sayfa en büyük ölçeği taşır.
- **Landing (`app/(main)/page.tsx`):** asimetrik hero — sol metin blok /
  sağda mock kart ("Karanlık mod desteği") + "Nasıl çalışır" 1-2-3
  şeridi (Topla / Anla / Duyur). Bölüm h2'leri tek ölçekte
  (`text-2xl bold tracking-tight`); eyebrow pill YOK. Kapanış CTA
  paneli `bg-brand-soft` — marka ailesinden tek bold leke; üzerinde
  mürekkep metin + mercan buton (beyaz-on-mercan yok, §1).
- **Portal fikir detayı (2026-09-05):** lg+ iki kolon — solda fikir
  kartı + durum geçmişi + yorumlar, sağda ~340px "Detaylar" yan
  paneli (admin panelleri + herkese açık özel alanlar). Mobilde tek
  kolon; yan panel alta düşer. Canny/Frill post-detay deseni.
- **Breadcrumb (2026-09-05, rev. 2):** `components/custom/page-breadcrumb.tsx`
  — alt sayfalarda (`portal/[id]`, `portal/oyladiklarim`, `changelog`,
  `changelog/[id]`, `roadmap`) "Portal / Başlık" biçiminde konum verir;
  "...dön" back-link'lerinin yerini aldı (changelog ArrowLeft,
  roadmap sağdaki ← linkiydi). Breadcrumb her zaman `<main>`'in ilk
  elemanı, solda; ilk içerik bloğu `mt-6`. Son öğe `aria-current="page"`
  + `truncate`; ayraç ChevronRight. Tek seviyeli sayfalarda, dashboard
  ve widget'ta breadcrumb YOK (üst bar + sidebar konumu zaten verir).
- **Genişlik disiplini (2026-09-05, rev. 3 — işe göre hizalama):**
  **Herkese açık yüzeyler** (landing, demo, pricing, portal + alt
  sayfaları, roadmap, changelog) ortalanmış kolon: `container mx-auto
  max-w-6xl` — gösteri/okuma ölçeği ister; landing hero'sundaki
  asimetrik bloklar kolon içinde kalır. **Uygulama sayfaları**
  (dashboard + admin ekranları) tam genişlik `max-w-none` + **sola
  yaslı** — sidebar'lı veri yüzeyi, tablo/liste yoğunluğu için.
  İçeride uzun okuma metinleri (legal, changelog gövdesi, boş durum
  metinleri) her iki tipte de `max-w-prose` alabilir.
- **Sayfa deseni (admin):** başlık satırı (h1 + muted açıklama solda,
  primary aksiyon sağda) → KPI şeridi (4 kart; 2×2 tablet, tek kolon
  mobil) → araç çubuğu (FilterTabs solda, kayıtlı görünüm + aksiyonlar
  sağda) → tablo → yönetim bölümleri kart grupları halinde; ritim
  `space-y-6/8`.
- **Bölüm sekmeleri (2026-09-05):** uzun admin sayfaları tek yığın
  olmaz — dashboard `?tab=` ile iş akışına bölünür (Genel Bakış /
  Fikirler / Yayın / Planlama / Entegrasyonlar). Desen: FilterTabs,
  value `""` varsayılan bölüm; KPI şeridi her sekmede kalır, kart
  grupları sekmeyle değişir (anlık RSC swap, geçiş animasyonu yok —
  §8). Sekme içi filtreler (status/tag/per/board/page) ve kayıtlı
  görünümler (`saved-view-bar` `preserveParams`) `tab` parametresini
  korumak zorunda.
- **Sayfa deseni (public):** portal tek kolon kart listesi (oy düğmesi
  solda); detay `lg`'de 2 kolon (2fr içerik / 1fr meta); dokunma hedefi
  ≥40px.

## 5. Bileşenler

- **Radius iki katman (2026-09-05):** uygulama içi kartlar ve primitifler
  `rounded-xl` (Card primitive zaten böyle); marketing/display yüzeyleri
  (landing, demo, pricing kartları, CTA paneli, toast) `rounded-2xl`;
  küçük elemanlar (buton, input, badge) token radius (`rounded-md`
  ailesi). Elle kart yazarken Card primitive'ini kullan ya da bu
  katmanlara uyun — tek radius her yerde değil, hiyerarşi koda yansır.
- **Rozet tek kabuk (2026-09-06):** `components/ui/badge.tsx` (Badge) —
  `rounded-full` pill; semantik rozetler (StatusBadge / TypeBadge /
  SentimentBadge) yalnız kendi ton class'ını `className` ile verir, kabuğu
  kopyalamaz. Yeni rozet bu primitive'ten üretilir (kopya `span` kabuğu yazılmaz).
- **`components/ui/`** — Base UI (`@base-ui/react`) primitive'leri + cva
  varyantları. `Button` Base UI `render` prop destekler (Link vs. için).
  Primitive'ler: `badge` · `button` · `card` · `checkbox` · `dialog`
  · `dropdown-menu` · `input` · `label` · `select` (F4 — tek native select
  standardı) · `table` · `textarea` · `toast`.
- **Button varyantları:** `default` (mercan/mürekkep) `outline` `secondary`
  `ghost` `destructive` (soft) `link`; boyutlar `default` `xs` `sm` `lg`
  `icon` `icon-xs` `icon-sm` `icon-lg`.
- **`components/custom/`** — ürün kalıpları. YÜZEYE GÖRE tasarım kanonu (2026-09-06
  güncel, eksiksiz liste — yeni bileşeni buraya eklemezsen kanon dışı kalır):

  **Kabuk / shared**
  `site-header` (mobil hamburger) · `site-footer` (logo + şirket linkleri)
  · `app-sidebar` · `theme-provider` · `theme-toggle` · `clerk-trigger-button`
  · `page-breadcrumb` · `filter-tabs` · `pagination-footer`
  · `notice` (hata/kutu) · `empty-state` (boş durum) · `not-found-view`
  · `markdown-content` · `canonical-link` (client legacy; server-side yeğlendi)

  **Portal topluluk**
  `keyword-chips` · `tag-chips` · `status-badge` · `type-badge` · `sentiment-badge`
  · `vote-button` · `comment-card` · `comment-form` · `comment-count-badge`
  · `follow-button` · `new-post-dialog` · `corpus-insights` · `idea-card`
  · `powered-by-feedl` (free-only rozet) · `email-deliverability-card` (dashboard)

  **Admin yönetim**
  `posts-table` · `status-select` · `type-select` · `board-select`
  · `board-filter-select` · `saved-view-bar` · `autopilot-inbox` · `merge-controls`
  · `roadmap-planner` · `roadmap-columns` · `changelog-admin`
  · `changelog-subscribe-form` (public) · `companies-manager`
  · `opportunity-link-controls` · `custom-fields-manager` · `custom-values-panel`
  · `members-manager` · `workspaces-manager` · `workspace-settings`
  · `boards-manager` · `activation-funnel` · `analytics-overview` · `revenue-report`
  `api-keys-manager` · `webhooks-manager` · `widget-origins-manager`
  · `widget-setup` · `billing-overview` (yeni 63l) · `plan-change-card` (yeni 63x)
  · `pricing-manager` (public)
  · `integrations-panel` · `linear-integration` · `import-csv-button`
  · `insights-refresh-button` (yeni 63l).

  **Onboarding / auth**
  `onboarding-wizard` · `onboarding-checklist` · `invite-accept-form`

  **Widget (izole / bare)**
  `widget-post-form` · `widget-vote-button` · `widget-triage`

  **Saf veri/konfig**
  `plan-config` (.ts — Paddle plan sabitleri)

- **Eski vs yeni kalıp (2026-09-06 not):** bileşenler paylaşılan tek-kaynakları
  kullanır — Badge (status/type/sentiment), Notice (hata), EmptyState (boş durum),
  Button render-Link. Yeni bileşen bu tek-kaynaklardan üretilir; kopya kabuk
  yazılmaz.
- **Tek fikir kartı (F5, 2026-09-06):** `idea-card.tsx` — portal/roadmap/changelog
  + landing/demo mock kartlarının TEK kaynağı. `href` verilirse Link, verilmezse
  mock `span`; `ariaHidden` flag; `commentCount` + `commentPostId` yoksa statik
  sayı (CommentCountBadge yerine). `demo-post-card` **silindi** (F5).
- **Workspace marka aksanı (F3, 2026-09-06):** workspace `brandColor` varsa
  `(main)/layout.tsx` `<style>` ile `--brand/--primary/--primary-foreground
  (WCAG textOn)/--brand-soft/--brand-tint` override eder — portal oy/buton/odak
  workspace markasına renklenir; varsayılan mercan korunur.
- **Canonical (F2, 2026-09-06):** server-side — `middleware` `x-feedl-pathname`
  header + `lib/seo.ts` `generateCanonical` (\(generateMetadata\)): tam path +
  workspace custom domain; query varyantları (sort/tag) tek canonical'a düşer.
- **Hata/bilgi kutusu tek kaynak (2026-09-06):** destructive hata bildirimleri
  `notice.tsx` (Notice) bileşeninden geçer — satır içi kompakt `size="sm"`,
  sayfa düzeyi `size="md"`; `rounded-md` (küçük eleman radius). Kopya
  `border-destructive/…` kutuları yazılmaz.
- **Açılır-kapanır (2026-09-06):** `disclosure.tsx` (Disclosure) — kart
  başlığı + chevron, varsayılan kapalı; erişilebilir `aria-expanded`/region.
  Uzun/opsiyonel içerik bölümlerinde kullan.
- Yeni bileşen: primitive gerekirse `ui/`, ürün kalıbı `custom/`; mümkünse
  mevcut `status-badge` / `type-badge` gibi tek kaynakları yeniden kullan.

### Kart rolleri ve yükseklik (2026-09-05)

"Her karta aynı radius + aynı gölge" klişesine panzehir — kart dört rol
oynar:

| Rol | Gölge | Radius | Hover |
|-----|-------|--------|-------|
| Yüzey kartı (içerik) | yok | `radius-lg` | yok |
| Etkileşimli kart (kanban, portal fikir) | hover'da `shadow-xs` | `radius-lg` | `translateY(-2px)` + cursor-pointer, 150ms |
| Yüzen katman (dialog/popover/dropdown/toast) | `shadow-md/lg` | `radius-xl` | giriş animasyonu |
| KPI kartı (mono sayı) | yok | `radius-lg` | yok |

- Gölge kademeleri: `shadow-xs` (hover), `shadow-md` (popover),
  `shadow-lg` (dialog). **`transition: all` yasak** — yalnız
  `transform` / `opacity` / renk özellikleri geçiş yapar.
- Koyu modda yükseklik sinyali gölgeden değil **border aydınlanması +
  zemin farkından** gelir (kart 0.205 vs zemin 0.145).
- Radius disiplini: kart/buton `lg`, dialog `xl`, rozet/avatar `full`,
  input `md` — her rolde tek değer.
- **Kart iç düzeni (Sprint 64, 2026-09-07):** kartın iki bölgesi kullanılır; elemanlar
  alt alta dizilmez. Grid: `[minmax(0,1fr) | auto]`.
  - SOL (min-w-0): başlık + rozetler üst satır → etiketler → metin (`content` dahil) — dikey.
  - SAĞ (shrink-0): yorum + oy (üst, sağa hizalı) → tarih (alt).
  - Tek kaynak: `components/custom/idea-card.tsx` (portal/roadmap/changelog/landing/demo
    aynı kart). Oy butonu (`voteAction`) ve yorum sayısı sağda; dar ekranda taşma olmaz
    (içerik min-w-0, sağ sütun sabit).
- **Card elevation prop (2026-09-06):** `elevation="interactive"`
  (`components/ui/card.tsx`) hover'da `shadow-xs` + `-translate-y-0.5`
  (150ms, transform/box-shadow) verir; `floating` `shadow-lg`; varsayılan
  `surface` hover'sız. Etkileşimli kartlar (portal fikir, kanban,
  roadmap) bunu kullanır — manuel hover class'ı kartlara yazılmaz.

## 6. Koyu Mod

- **next-themes** (`components/custom/theme-provider.tsx`); `(main)`
  layout'unda `attribute="class"`, `defaultTheme="system"`,
  `enableSystem`, `disableTransitionOnChange`.
- `defaultTheme="system"` **karara bağlandı** (2026-09-05): global dark
  default YOK; public portal kullanıcının sistem tercihini izler.
- `.dark` class tabanlı (`@custom-variant dark (&:is(.dark *))`).
- Her token'ın `.dark` karşılığı globals.css'te tanımlı — yeni token eklerken
  iki modu birlikte tanımla.
- **ThemeToggle** (`components/custom/theme-toggle.tsx`): üst barda switch;
  açıkken güneş, koyuyken mercan zemin üzerine kayan ay; mount öncesi ikon
  çizilmez (hydration güvenli). `suppressHydrationWarning` root'ta değil,
  provider `(main)`'de olduğu için gerekmedi.
- **`/widget` izole:** bare root layout kullanır, temadan etkilenmez —
  widget'a özel CSS'ine dokunma.
- Clerk ekranları shadcn görünümü (`lib/clerk-theme.ts` — inline
  `variables`/`elements`, `@clerk/themes` paketi değil); `html` `.dark` alınca
  koyulaşır.

## 7. Dokunma Kuralları

1. StatusBadge / columnDotStyles / SentimentBadge anlamsal renkleri
   değiştirilmez.
2. `--primary-foreground` her zaman `#2b0e04` kalır — beyaz-on-mercan yok.
3. İkinci marka aksanı rengi eklenmez; ihtiyaç olursa brand ailesinden
   ton türetilir.
4. Widget CSS'i (kendi görünümü) izole kalır; taşıma/renk değişikliği yapma.
5. Destructive kırmızısıyla mercan karıştırılmaz.
7. Doğrulama **yalnızca** `npm run build`; `npm run dev` kullanılmaz,
   canlıda kullanıcı testi tercih edilir.
8. `transition: all` yazılmaz; geçiş yalnız `transform` / `opacity` /
   renk özelliklerinde, 150–200ms ease-out (bkz. §8).
9. Sayfa başına en fazla bir orkestralanmış an (landing hero girişi);
   `prefers-reduced-motion` her zaman saygı görür.
10. Butonlar pointer imleç: `@layer base` kuralı (globals.css) —
    Tailwind v4 preflight varsayılanını ezer.

## 8. Hareket (2026-09-05)

Hareket **eyleme cevap verir**; süs değildir. Süreler: hızlı 150ms
(hover, popover), taban 200ms (dialog, durum geçişi), `ease-out`
(`--ease-out-quart` globals.css'te).

| İzinli (eylem geri bildirimi) | Yasak |
|-------------------------------|-------|
| Dialog: fade + `scale 0.96→1`, 200ms | Her section'a fade-up |
| Popover: fade + 4px slide, 150ms | Her kartta hover animasyonu |
| Oy düğmesi: `scale 0.95→1` pop + sayaç güncellenmesi | KPI sayaç animasyonu |
| Rozet durum geçişi: renk 200ms | Döngülü/loop animasyonlar, parallax |
| Toast: alttan slide | Sayfa geçiş animasyonları |
| Tek orkestra: landing hero tek seferlik kademeli fade-up (`.hero-rise`, 60ms aralık, 450ms; reduced-motion gecikmeyi de sıfırlar) | |

`@media (prefers-reduced-motion: reduce)` bloğu globals.css'te tüm
dekoratif süreleri etkisizleştirir. FilterTabs optimistic davranışı
("eyleme cevap" örneği) korunur.
7. Her UI değişikliği küçük batch + ayrı commit; kullanıcıya isim vermeden
   uygula, deploy sonrası kısa test listesi sun.

## 9. Handoff Spec (dev implementasyon için kanonik referans)

> Bu bölüm §1–8'in özet uygulamasıdır: dev, yeni bir ekran/kart yazarken
> yalnızca buraya bakar. Tüm değerler `app/globals.css` gerçek token'larından;
> değer yerine token adı kullanılır (`text-sm` ≠ `14px`). Kod eşleşmezse
> kod gerçek kaynaktır (§0).

### 9.1 Token referansı

| Token | Açık | Koyu | Kullanım |
|-------|------|------|----------|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Sayfa zemini |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Birincil metin |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Kart/popover zemini |
| `--muted` / `--muted-foreground` | `0.97` / `0.556` | `0.269` / `0.708` | İkincil metin, rozet, nötr zemin |
| `--border` / `--input` | `oklch(0.922 0 0)` | `1 0 0 / 10%` / `15%` | Ayırıcılar, input kenarı |
| `--brand` | `#ff5c35` | `#ff5c35` | Tek aksan (buton/oy/odak) |
| `--brand-strong` | `#c7360f` | `#ff8c66` | Aksan üzeri metin/hover |
| `--primary-foreground` | `#2b0e04` | `#2b0e04` | Beyaz değil koyu mürekkep (AA 5.9:1) |
| `--ring` | `#ff8c66` | `#ff8c66` | Odak halkası |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Hata / yıkıcı |
| `--sidebar*` | nötr grafit (L216/145…) | aynı aile | Yalnız admin sidebar |

**Radius ölçeği** (`--radius` `0.625rem`):
`sm 0.375` · `md 0.5` · `lg 0.625` (kart/buton) · `xl 0.875` (dialog) ·
`2xl 1.125` (marketing) · `3xl 1.375` · `4xl 1.625`.

**Boşluk:** Tailwind v4 varsayılan ölçeği (4px taban): `gap-1 4px` ·
`gap-2 8px` · `gap-3 12px` · `gap-4 16px` · `p-4/p-5/p-6` … Sayfa ritmi
`space-y-6/8`.

**Tipografi (kullan, eşdeğer px yazma):**
h1 sayfa `text-2xl bold tracking-tight` · bölüm h2 `text-base semibold` ·
gövde `text-sm` · meta `text-xs text-muted-foreground` · KPI `font-mono text-3xl
tabular-nums` · landing hero `text-4xl sm:text-5xl lg:text-6xl`.

### 9.2 Breakpoints (Tailwind varsayılanı)

| Ad | Değer | Davranış |
|----|-------|----------|
| `sm` | 640px | Landing hero tek kolon → 2 kolon; çoklu kartlar 2 sütun |
| `md` | 768px | Üst bar nav görünür (hamburger kapanır); 2×2 KPI/tablet |
| `lg` | 1024px | Portal fikir detayı 2 kolon; pricing kartları yan yana |
| `xl` | 1280px | Geniş dashboard veri yoğunluğu; `max-w-6xl` public kolon |
| `2xl` | 1536px | (nadir) |

Public yüzeyler: `container mx-auto max-w-6xl`; admin: `max-w-none` sola
yaslı; uzun metin: `max-w-prose`/`max-w-3xl`. Mobilde her şey tek kolon;
birincil aksiyon tam genişlik.

### 9.3 Bileşen state'leri

| Bileşen | Variant | State'ler | Not |
|---------|---------|-----------|-----|
| `Button` | default/outline/secondary/ghost/destructive/link | default · hover (`bg-accent`/brand-strong) · active · disabled (`opacity`, `pointer-events`) · loading (spinner yerine disabled + metin) | `render` prop ile Link; `size` sm/lg/icon |
| `Card` | surface/interactive/floating | surface: gölgesiz · interactive: hover `shadow-xs` + `-translate-y-0.5` 150ms · floating: `shadow-lg` | `elevation` prop |
| `Badge` | pill | default · ton class'ı (Status/Type/Sentiment) | `ui/badge.tsx` tek kabuk |
| `Notice` | sm/md | error · info | Kopya hata kutusu YAZILMAZ |
| `EmptyState` | sm/lg | boş durum | Kesik kenarlık + title/children/action |
| `IdeaCard` | interactive | hover (translateY) · focus (odak halkası) · mock (`aria-hidden`) | İki bölge grid |

**Yükleme:** veri bölgelerinde spinner (köşeli değil `Loader2 animate-spin`)
veya EmptyState; **hata:** `Notice tone=error`; **boş:** `EmptyState`;
**yoksayılır/okunmamış:** yalnızca anlamsal renkler.

### 9.4 Edge case'ler

- **Uzun metin:** başlık `min-w-0` + `leading-snug`; açıklama `line-clamp`;
  sağ kolon `shrink-0` (IdeaCard iki bölge grid taşmayı engeller).
- **Uzun Türkçe/çok dilli:** `font-sans` Manrope latin-ext (Türkçe destek);
  başlık satır sonu `whitespace-pre-line`; `truncate` breadcrumb'da.
- **Boş liste:** `EmptyState` (kesik kenarlık, başlık + açıklama + CTA).
- **Hata / geçersiz imza / api hata:** `Notice tone=error` (row `sm`, sayfa `md`).
- **Eksik veri (null sayı, yok kayıt):** `—`/`null` göster; asla `NaN`.
- **Yavaş bağlantı:** veri yoğun sayfalarda `dynamic`/skeleton yerine
  RSC loading; uzun listeler sayfalama (PaginationFooter) — tek seferde
  sunucuya 5'li/25'li gelir.
- **Uzun fiyat/ID:** `paddleSubscriptionId` vb. `text-xs text-muted-foreground`
  `break-all`/`truncate`; KPI değerleri `font-mono tabular-nums`.
- **Kasıtlı sabit ölçümler (bilinçli, token-dışı; `[..]` yasak değil):**
  - Tablo sütun genişlikleri `w-[40px]/[60px]/[80px]/[140px]…` (posts/roadmap
    tabloları — yoğun veri hizalaması; `w-[40px]` checkbox, `w-[170px]` durum).
  - Boş durum yükseklikleri `min-h-[120px]/[200px]`, tam sayfa `min-h-[60vh]`
    (EmptyState/CTA kutuları — içerik yokken dengeli görünüm).
  - Sidebar: `h-[calc(100svh-3.5rem)]` (üst barın altı), kapalı `w-14`, açık
    `w-60`, mobil `max-w-[85vw]`, çekmece `w-64`.
  - Seçim kontrolleri `w-[130px]/[150px]/[240px]` (rol/board/filtre) +
    `max-w-[240px]/[280px]/[320px]` (sıkışık alanlarda `truncate` ile).
  Bu sabitler ölçü değil **yapı amacı** taşır (kolon/boşluk/sidebar); yeni bir
  sabit eklerken aynı amacı belgeli kullan. (Tipografi ölçüleri ise her zaman
  `text-sm/xs/base` ölçeğinden — yukarıdaki fixed `text-[..]` fontlar §9.1
  ölçeğine çekildi.)

### 9.5 Erişilebilirlik kontrol listesi

- **Kontrast:** `--primary-foreground #2b0e04` (ink-on-coral 5.9:1 ✓);
  beyaz-on-mercan YASAK. Doğrulama: `tests/lib/color-contrast.test.ts`
  (`contrastRatio` ≥ 4.5).
- **Odak:** `--ring #ff8c66` global `outline-ring/50`; tüm etkileşimli
  elemanlarda görünür odak.
- **Dokunma hedefi ≥ 40px:** `Button size` ailesi + oy/ikon `size-*`;
  mobilde tam genişlik aksiyon.
- **ARIA/rol:** nav `aria-label`/`aria-current`; dialog `aria-expanded`;
  mock kart `aria-hidden`; durumlar `role=status`/`role=alert`;
  ikonlar `aria-hidden`.
- **Klavye:** native `select`/`button`/`Link`; dialogu `Escape`/overlay;
  disclosure `aria-expanded` + bölge.
- **Hareket azaltma:** `prefers-reduced-motion` globals.css bloğu tüm
  dekoratif süreleri sıfırlar (§8).
