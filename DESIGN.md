# feedl — Tasarım Referansı

> Sprint 35–36'da tanımlanan tasarım dilinin tek kaynağı. Yeni bileşen,
> ekran veya UI değişikliği yaparken önce bu dosyaya bak; kuralda değişiklik
> gerekirse önce buranın güncellenmesi, sonra koda yansıtılması gerekir.
> Renk ve tipografi değerleri `app/globals.css` içindeki gerçek token'lardan
> birebir alınmıştır; kod eşleşmezse kod gerçek kaynaktır.

## 1. Tasarım İlkesi

- Kategori rakipleri (Canny, Frill, Nolt, Featurebase, UserJot) mavi/mor
  denizinde — **mercan tek marka aksanı ile ayrışma**.
- **Tek aksan disiplini:** Mercan markaya aittir; mor, mavi, yeşil vb.
  renkler yalnızca durum/duygu rozetlerinde anlamsal olarak kullanılır.
- Ton: "geri bildirim = insan sesi". Arayüz metni sade Türkçe, aktif ses,
  söz değil eylem ("Kaydet", yayınlandığında "Yayınlandı").
- Mercan zemin üzerine **beyaz değil koyu mürekkep** — white-on-coral
  3.1:1 (AA başarısız), ink-on-coral 5.9:1 ✓.

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
  `--card` / `--popover` 0.205.
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

## 3. Tipografi

- **Metin + başlık:** Manrope (latin + latin-ext, Türkçe destekli) —
  `--font-app-sans`, `html` üzerinde `font-sans`.
- **Sayılar/veri:** Geist Mono — `font-mono` (dashboard istatistikleri,
  sayaçlar, tablo sayıları).
- Başlıklar h1–h4: `letter-spacing: -0.02em` (globals.css `@layer base`).
- E-posta şablonları **sistem fontu** — kasıtlı, dokunma.

## 4. Kabuk ve Yerleşim

- `app/(main)/layout.tsx`: `ClerkProvider(shadcn)` > `ThemeProvider` >
  `flex min-h-svh flex-col` (üst bar / flex-1 içerik / alt bar).
- **Üst bar** (`components/custom/site-header.tsx`): `h-14`,
  `container mx-auto max-w-5xl`; marka karosu (`size-6 rounded-md bg-brand`
  + ChevronsUpIcon koyu mürekkep), aktif nav vurgusu `bg-muted`
  (`usePathname`; `/portal/changelog` hariç `/portal*` Portal'ı aktif eder);
  sağda `ThemeToggle` + Clerk butonları.
- **Alt bar:** `border-t`, tek satır marka cümlesi + 3 bağlantı
  (Portal / Yol Haritası / Güncellemeler).
- **Landing (`app/(main)/page.tsx`):** asimetrik hero — sol metin blok /
  sağda mock kart ("Karanlık mod desteği" + Autopilot şeridi) + "Nasıl
  çalışır" 1-2-3 şeridi (Topla / Anla / Duyur).
- Genişlik disiplini: içerik `max-w-5xl`; dashboard tabloları tam genişlik
  container üzerinden. Alan sol bakışa değil, işe göre hizalanır.

## 5. Bileşenler

- **`components/ui/`** — Base UI (`@base-ui/react`) primitive'leri + cva
  varyantları. `Button` Base UI `render` prop destekler (Link vs. için).
- **Button varyantları:** `default` (mercan/mürekkep) `outline` `secondary`
  `ghost` `destructive` (soft) `link`; boyutlar `default` `xs` `sm` `lg`
  `icon` `icon-xs` `icon-sm` `icon-lg`.
- **`components/custom/`** — ürün kalıpları. Başlıca: `site-header`,
  `theme-toggle`, `status-badge`, `sentiment-badge`, `type-badge`,
  `vote-button`, `comment-card`, `comment-form`, `filter-tabs`,
  `keyword-chips`, `tag-chips`, `posts-table`, `autopilot-inbox`,
  `merge-controls`, `roadmap-planner`, `changelog-admin`, `new-post-dialog`,
  `companies-manager`, `opportunity-link-controls`, `widget-post-form`,
  `widget-vote-button`, `widget-setup`, `api-keys-manager`,
  `webhooks-manager`, `saved-view-bar`, `analytics-overview`,
  `not-found-view`.
- Yeni bileşen: primitive gerekirse `ui/`, ürün kalıbı `custom/`; mümkünse
  mevcut `status-badge` / `type-badge` gibi tek kaynakları yeniden kullan.

## 6. Koyu Mod

- **next-themes** (`components/custom/theme-provider.tsx`); `(main)`
  layout'unda `attribute="class"`, `defaultTheme="system"`,
  `enableSystem`, `disableTransitionOnChange`.
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
6. Doğrulama **yalnızca** `npm run build`; `npm run dev` kullanılmaz,
   canlıda kullanıcı testi tercih edilir.
7. Her UI değişikliği küçük batch + ayrı commit; kullanıcıya isim vermeden
   uygula, deploy sonrası kısa test listesi sun.
