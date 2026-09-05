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

### Yapısal slate — admin sidebar yüzeyi (2026-09-05 kararı)

Aksan değil **nötr yapı**: yalnız admin sidebar zemininde. Değerler
Tailwind slate ailesinin oklch karşılıkları; `--sidebar-*` tokenları
artık bu değerleri taşır (`app/globals.css`).

| Token | Açık mod | Koyu mod | Kullanım |
|-------|----------|----------|----------|
| `--sidebar` | slate-900 `oklch(0.208 0.042 265.755)` | slate-950 `oklch(0.129 0.042 264.695)` | Kabuk zemini |
| `--sidebar-foreground` | slate-100 `oklch(0.968 0.007 247.896)` | aynı | Metin |
| `--sidebar-primary` | `var(--brand)` | `var(--brand)` | Aktif nav — mercan, eylem rengi |
| `--sidebar-primary-foreground` | `#2b0e04` | `#2b0e04` | Mürekkep — kural 2 geçerli |
| `--sidebar-accent` | slate-800 `oklch(0.279 0.041 260.031)` | aynı | Hover yüzeyi |
| `--sidebar-border` | `oklch(1 0 0 / 8%)` | `oklch(1 0 0 / 10%)` | Ayırıcılar |

Slate içerik alanına, butonlara, rozetlere sızmaz; sidebar kabuğuyla
sınırlıdır.

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
Ayarlar); altta UserButton. Bileşen: `app-sidebar` — dashboard altı
`layout.tsx` sağlar; rail durumu localStorage.

**Sidebar rol kademesi (2026-09-06, kullanıcı onaylı yetki matrisi):**
`workspace_members.role` → owner/admin (tam), contributor (kısmi team),
member (public). Contributor, `adminOnly` işaretli öğeleri (Gelir / Üyeler /
Çalışma Alanları / Widget / Faturalama / Ayarlar) sidebar'da GÖRMEZ; onun
nav listesi Genel Bakış / Board'lar / Aktivasyon / AI İçgörüleri / Şirketler /
Alanlar olur. `layout.tsx` `getDashboardScope()` ile `scope="admin|"team`
prop'unu `AppSidebar`'a geçirir.

- `app/(main)/layout.tsx`: `ClerkProvider(shadcn)` > `ThemeProvider` >
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
- **`components/ui/`** — Base UI (`@base-ui/react`) primitive'leri + cva
  varyantları. `Button` Base UI `render` prop destekler (Link vs. için).
- **Button varyantları:** `default` (mercan/mürekkep) `outline` `secondary`
  `ghost` `destructive` (soft) `link`; boyutlar `default` `xs` `sm` `lg`
  `icon` `icon-xs` `icon-sm` `icon-lg`.
- **`components/custom/`** — ürün kalıpları. Başlıca: `site-header`,
  `app-sidebar`, `theme-toggle`, `status-badge`, `sentiment-badge`, `type-badge`,
  `vote-button`, `comment-card`, `comment-form`, `filter-tabs`,
  `keyword-chips`, `tag-chips`, `posts-table`, `autopilot-inbox`,
  `merge-controls`, `roadmap-planner`, `changelog-admin`, `new-post-dialog`,
  `companies-manager`, `opportunity-link-controls`, `widget-post-form`,
  `widget-vote-button`, `widget-setup`, `api-keys-manager`,
  `webhooks-manager`, `saved-view-bar`, `analytics-overview`,
  `not-found-view`, `page-breadcrumb`, `notice`.
- **Hata/bilgi kutusu tek kaynak (2026-09-06):** destructive hata bildirimleri
  `notice.tsx` (Notice) bileşeninden geçer — satır içi kompakt `size="sm"`,
  sayfa düzeyi `size="md"`; `rounded-md` (DESIGN.md §5 küçük eleman radius).
  Kopya `border-destructive/…` kutuları yazılmaz.
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
- Clerk ekranları shadcn teması; `html` `.dark` alınca koyulaşır.

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
