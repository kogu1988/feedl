# feedl — AI Destekli Müşteri Geri Bildirim Platformu

feedl, ürün ekiplerinin müşteri geri bildirimini toplaması, **AI ile analiz etmesi**,
önceliklendirmesi ve duyurması için tek bir platformdur. Canny'nin ücretsiz
planına bir alternatif — herkese açık bir topluluk portalı + gelir odaklı
önceliklendirme.

**Canlı:** [https://feedl.app](https://feedl.app)

> **Tek söz kaynağı:** Bu README (ürün + konumlandırma + temel özellikler).
> UI metinleri (`landing / pricing / demo`) buradaki söz dağarcığından beslenir.

---

## Ne yapar?

1. **Topla:** Müşterilerin istekleri tek bir panoya düşer; oylar en çok istenen
   özelliği üste taşır. Widget ile kendi sitenize gömülür.
2. **Anla:** Autopilot her fikri özetler, etiketler ve benzer istekleri işaretler;
   duygu analizi ve korpus içgörüleriyle tahmin değil veriyle karar verirsin.
3. **Önceliklendir & Yol Haritası:** Durumlar (`Açık → Planlandı → Geliştiriliyor →
   Yayında`) ve gelir skoru (oy + müşteri + fırsat) ile hangi özelliğin önce
   geleceğini gör.
4. **Duyur:** Yayına aldığında oy verenlere ve takipçilere otomatik e-posta gider;
   herkese açık bir değişiklik günlüğü oluşur.

## Kimin için

- **Hedef müşteri:** KOBİ / erken aşama SaaS ürün sahibi (tek ürün, küçük ekip).
- **Yarı-yarına:** ~2–20 kişilik ürün + destek ekibi; geri bildirim dağınık
  (e-posta, destek, Slack, roadmap) birikiyor.
- **Kullanıcı:** Client'ın (platformu kullanan şirketin) **müşterileri** —
  public portalda oy veren son kullanıcılar.

## Değer önerisi

> **"Müşteri isteklerini tahminle değil, veriyle önceliklendir."** — Feedl,
> geri bildirimi otomatik sınıflandırır, duygu analizi yapar, kopyaları yakalar,
> gelir bağlamını (müşteri + fırsat değeri) birleştirip hangi özelliğin önce
> geliştirileceğini gösterir; yayınlanınca herkese otomatik duyurur.

## Temel özellikler

1. **Autopilot (AI):** Her fikir otomatik özet + etiket + benzer eşleştirme +
   duygu analizi. Korpus seviyesi içgörüler (temalar, riskler, hızlı kazanımlar).
2. **Oylama & Yol Haritası:** Şeffaf durumlar; sürükle-bırak kanban; herkese
   açık yol haritası.
3. **Değişiklik Günlüğü:** Draft → yayın akışı; herkese açık güncelleme sayfası.
4. **Gelir Skoru:** Oy + müşteri sayısı + fırsat değeri (MRR) → revenue-weighted
   prioritization.
5. **Ekip & Roller:** Owner / admin / contributor / member — kısmi dashboard
   erişimi, iç notlar (private).
6. **Entegrasyonlar:** Slack, Zendesk, Intercom, Linear, Jira, Webhook'lar,
   Public API (`/api/v1`) + müşteri sitesine gömülen widget.
7. **Multi-tenant:** Her workspace kendi subdomain'i (`acme.feedl.app`), kendi
   markası (logo/renk/domain), kendi board'ları.
8. **Public API + Webhook:** HMAC-SHA256 imzalı olaylar, anahtar erişimi.
9. **Görsel geri bildirim & teknik bağlam:** Kullanıcı sayfada sorunlu noktayı
işaretler (pin); cihaz/viewport/tarayıcı/OS otomatik eklenir, ekran görüntüsü
alınır (private Blob). Adminde cihaz filtresi (Masaüstü/Tablet/Mobil).
10. **AI triage öğrenmesi:** Admin bir fikri "ilgisiz" işaretler ya da AI'nın
türünü düzeltir → workspace-scoped sinyaller sonraki sınıflandırmayı yönlendirir.
11. **Haftalık AI özeti (digest):** Pazartesi sabahı Pro workspace'ler için
korpus analizi yeniden üretilir; yeni geri bildirim varsa admin'lere tema/risk/
hızlı kazanım özeti e-posta olarak gider (tek tıkla kapatılabilir).

## Farklılaşma (neden feedl?)

| | Canny ($79/ay Pro) | FeedLog (self-host) | **feedl** |
|---|---|---|---|
| Hosted + hızlı kurulum | ✅ | ❌ (self-host) | ✅ |
| AI analiz (etiket/özet/duygu) | ✅ | ⚠️ | ✅ |
| Gelir/opportunity skoru | ✅ | ❌ | ✅ |
| Public API + Webhook | ✅ | ⚠️ | ✅ |
| Fiyat | pahalı | ücretsiz+operasyon | **uygun, hosted** |

**Konum:** *"Canny'nin AI + gelir zekası, self-host derdi olmadan, uygun fiyata."*

## Söz dağarcığı (satış / UI)

Bir eylem/hedef tüm akışta **aynı adla** anılır (örn. "Fiyatlandırma",
"Ücretsiz Başla", "Yol Haritası"). Ton: sade, aktif, insan sesi — eylem fiilleri
("Kaydet", "Yayınla", "Bağlan"); son kullanıcı yüzeyinde jargonsuz (admin'de
teknik terim serbest).

| Yüzey | Ana mesaj | CTA |
|---|---|---|
| Landing | "Müşteri isteklerini veriyle önceliklendir" | Ücretsiz Başla · Canlı Demo · Fiyatlandırma |
| Demo | "feedl gerçekte nasıl görünür" | Ücretsiz Başla |
| Pricing | "Sade, ekip başına fiyatlandırma" | Pro'ya Geç |
| Portal/Roadmap/Changelog | Topluluk — "İstediğini söyle, oyla" | Fikir Gönder / Oy Ver |

**Kaçın:** "Kurumsal", "enterprise-grade", "AI devrimi" gibi boş terimler;
Canny'yi kötüleme ("ücretsiz alternatif" olarak konumlandır); son kullanıcı
yüzeyinde webhook/API jargonu kullanma.

## Fiyatlandırma (bkz. `pricing/page.tsx` · `components/custom/plan-config.ts`)

- **Free:** 1 board · 1 üye · 50 takipçi · "Powered by feedl" rozeti.
- **Pro:** Sınırsız board · 10 üye · özel domain · marka kaldırma. Aylık/yıllık.
- Model: **ekip/board başına** sabit ücret (kullanıcı başına değil) + workspace
  kaynak limitleri. (Paddle **live** — aylık $19 / yıllık; ücretsiz plan gerçek.)

## Teknoloji Stack'i

| Katman | Teknoloji |
| :--- | :--- |
| Framework | Next.js 15 (App Router, Turbopack) + React 19 |
| Hosting | Vercel (Hobby) |
| Auth | Clerk (multi-tenant workspace + rol kademesi) |
| DB | Neon PostgreSQL + pgvector (Drizzle ORM) |
| UI | Tailwind v4 + shadcn/ui + Base UI |
| Background | Inngest |
| AI | OpenRouter (`minimax/minimax-m3:free` LLM + fallback, `nemotron-3-embed-1b:free` embedding) |
| Email | Resend (deliverability webhook) |
| Billing | Paddle (live) |
| Rate-limit | Upstash Redis |

## Kurulum

```bash
npm install
cp .env.example .env.local  # env değişkenlerini doldur (aşağıya bak)
npm run dev                 # http://localhost:3000
```

### Ortam değişkenleri (`.env.local`)

- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`
- Neon: `DATABASE_URL`
- OpenRouter: `OPENROUTER_API_KEY`
- Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_API_KEY`
  - `INNGEST_DEV=1` **yalnız lokal** `.env.local` içindir: SDK'yı "dev" moduna
    alır → olaylar yerel Inngest Dev Server'a (`localhost:8288`) gider ve imza
    doğrulaması atlanır. Üretimde bu değişken **yoktur** (Vercel production'da
    doğrulandı); kaldırılırsa lokal kod Inngest Cloud'a bağlanır ve **gerçek**
    olay/otomasyon tetikleyebilir (gerçek e-posta gidebilir) — bilinçli yapın.
  - `INNGEST_API_KEY` yönetim REST API'si içindir; erişilebilen tek uç
    `GET https://api.inngest.com/v1/events` (uygulama/fonksiyon listesi yok —
    onun için panel kullanılır). Fonksiyon kaydını doğrulamanın yolu Inngest
    audit log'udur (`inngest/audit-log`, `action: function.updated`).
- Resend: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` · Test: `ETHEREAL_EMAIL_USER`, `ETHEREAL_EMAIL_PASSWORD`
- Widget: `FEEDL_WIDGET_SECRET`, `FEEDL_WIDGET_ALLOWED_ORIGINS`
- Paddle: `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Sentry: `SENTRY_DSN` (opsiyonel; DSN yoksa no-op)
- Analytics: `NEXT_PUBLIC_GA_ID` (opsiyonel; GA4 measurement ID ör. `G-XXXX`; setliyse gtag yüklenir, değilse no-op — Vercel Analytics zaten var)
- Şifreleme: `ENCRYPTION_KEY` (entegrasyon secret AES-256-GCM; prod'da zorunlu)
- AI: `LLM_MODEL`, `LLM_FALLBACK_MODEL` (ücretsiz flaky olursa ücretli fallback)
- App: `NEXT_PUBLIC_APP_URL`

Gizli değerler yalnız `.env.local`'de — repo'ya yazılmaz.

## Doğrulama

```bash
npm run build   # tip + lint (in-session tek doğrulama)
npm test        # Vitest birim testleri
npm run test:e2e  # Playwright + axe erişilebilirlik + auth akışı (çalışan sunucu gerekir)
```

### Test durumu (2026-09-10)

| Katman | Sonuç | Kapsam |
| :--- | :--- | :--- |
| **Birim test** (`npm test`) | ✅ 31 dosya · **156 test geçti** | Saf mantık: renk/WCAG, sayfalama, CSV, şifreleme, rate-limit, Paddle imza+plan türetme, oy doğrulama, post-format, post-search, widget-origins, widget gömme (body-bekleme), workspace-host çözümleme, AI içgörüleri, OpenRouter modelleri, e-posta teslimatı, haftalık digest e-postası + gönderim kararı, api-keys, davet e-postası, widget gönderim modu, free-plan oy limiti |
| **Tenant izolasyonu** | ✅ `resolveWorkspaceByHost` öncelik (custom_domain > subdomain > varsayılan) + hata | `tests/lib/tenant-isolation.test.ts` |
| **Paddle plan türetme** | ✅ `derivePlanFromStatus` (trialing/active→pro; canceled/past_due/dunned→free; unknown→null) | `tests/lib/paddle-plans.test.ts` |
| **Merge/unmerge karar mantığı** | ✅ Şema doğrulama (uuid, self-merge) + reason→HTTP eşleme | `tests/lib/post-merge.test.ts` |
| **Entegrasyon secret şifreleme** | ✅ `saveIntegration` + Linear connect `encryptSecret` (AES-256-GCM); okuma `decryptSecret` (düz eski satırlar backward-compat) | `tests/lib/encrypt.test.ts` |
| **E2E smoke** (`test:e2e`) | ⚠️ Sunucu gerekir; deploy/CI'da koşar | Ana yüzeyler + public API yüzeyi (OpenAPI, v1 401 gate) + axe a11y |
| **E2E auth akışı** | ⚠️ Clerk test env + seed gerekir; yoksa otomatik atlanır | Admin dashboard erişimi + portal fikir oluşturma |

> **Doğrulananlar (2026-09-07):** · `workspace_integrations` secret'ları `encryptSecret` ile şifreli (Linear/Jira/Slack/Zendesk/Intercom) ✓ · Public API **idempotency** (`withIdempotency`, `Idempotency-Key`) + **OpenAPI** (`/api/v1/openapi`) ✓ · `robots.txt`/`sitemap.xml` App Router route handler (`app/robots.txt/route.ts`) ✓. Mimari: kimlik Clerk, tenant/iş verisi Neon (Clerk Organization senkronu bilinçli YAPILMADI — karar 2026-09-07).

> Gerçek Neon/CI çalıştırması için: `npm run build && npm run start` sonrası
> `npm run test:e2e`. DB-backed testler Neon test şeması ister (prod DB'ye
> test koşulmaz).

> **E2E auth akışı (`e2e/auth-flow.spec.ts`):** Clerk test env'leri
> (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) yoksa akış otomatik
> atlanır (CI gizli anahtarsız yeşil). Etkinleştirmek için:
> 1. Clerk **dev instance**'da **Fakes** (test kullanıcıları) özelliğini aç
>    (Instance Settings → Dev / Testing).
> 2. `/api/webhooks/clerk` webhook'u kurulu olsun — fake kullanıcı girişinde
>    `user.created` DB'ye gerçek `user_...` ID ile kayıt düşürür.
> 3. Fake kullanıcının e-postasıyla admin yap:
>    `node scripts/seed-e2e.mjs "test+clerk_test@example.com" feedl`
>    (yerel script — gitignored; e-postayı gerçek fake e-postasıyla değiştir).
> 4. `npm run test:e2e` (çalışan sunucu + yerel DB).

> Not: Deploy, `main`'e push ile otomatiktir. Vercel Hobby planında kayan
> 24 saatte ~100 deploy limiti vardır — commit'leri biriktirip tek push'ta
> gönderin (bkz. `docs/standarts.md` §6).

## Proje Yapısı

```
app/               Next.js App Router (sayfalar + API route'ları)
  (main)/          Kabuk + public dashboard + portal + auth sayfaları
  api/             API route'ları (posts, votes, admin, v1, webhooks)
  widget/          İframe'de gömülen widget (bare shell)
components/
  ui/              Base UI primitive'leri (Button, Card, Badge...)
  custom/          Ürün bileşenleri (SiteHeader, Notice, EmptyState...)
lib/               db, ai, email, widget, webhooks, paddle, rate-limit
inngest/           Arka plan fonksiyonları (autopilot, notify, webhooks)
migrations/        Drizzle migration'ları
docs/              Planlama (gitignored) + standartlar
tests/             Vitest birim testleri
e2e/               Playwright smoke + axe erişilebilirlik
```

## Sistem Tasarımı (mimari — `system-design` çıkarımı)

### Yüksek seviye

```
     Public UI (landing/demo/pricing)    Dashboard (sidebar)    Widget (iframe)
                 └──────────────┬───────────────┘
                          Next.js 15 App Router (RSC + API)
         ┌─────────────────────┼──────────────────────┐
      Clerk                Neon PostgreSQL          Paddle
      (kimlik)          + pgvector (Drizzle)        (billing)
         │                     │                       │
         │             ┌───────┴───────┐               │
         │             │ Workspace     │               │
         │             │ · boards/posts· votes/comments·│
         │             │ · customers  · subscriptions· │
         │             └───────────────┘               │
         └─────────────────┼──────────────────────────┘
                        Inngest workers
                     ┌──────┼───────┐
                OpenRouter       Resend
             (LLM+embedding)     (email)
         Upstash Redis (rate-limit) · Vercel (hosting) · Sentry (errors)
```

### Veri akışı
- **Fikir:** `POST /api/posts` (auth, workspace-scoped, idempotent) → Neon
  (posts + embedding) → Inngest `autopilot` (etiket/özet/duygu/benzerlik +
  embedding → pgvector) → `corpus-insights` arka planda → yayında Resend e-posta.
- **Oy/yorum:** `vote*`/`comments` uçları (rate-limit + IP/anonim kimlik) → Neon.
- **Entegrasyon:** Slack/Zendesk/Linear/Jira webhook → `resolveIntegrationByUrlToken`
  → `workspace_integrations` (secret AES-256-GCM) → `sourceRef` unique ile
  idempotent post.
- **Billing:** Paddle webhook → `verifyPaddleWebhook` (SDK `isSignatureValid` +
  lenient parse) → `customers`/`subscriptions` upsert + `workspaces.plan` senkron
  (workspace_id eşleşmesi; slug fallback).

### API yüzeyleri
| Uç | Kimlik | Not |
|---|---|---|
| `/api/posts` | Clerk (GET public, POST auth) | workspace-scoped |
| `/api/admin/*` | Clerk + rol | owner/admin/contributor/member kademesi |
| `/api/v1/*` | Bearer API key (`fk_live_`) | `Idempotency-Key`, rate-limit
| `/api/webhooks/{paddle,clerk,slack,...}` | HMAC/imza | at-least-once, idempotent |
| Workspace çözümü | host / subdomain / custom-domain / widget-session | `getWorkspaceId` |

### Depolama & ölçek/güvenilirlik
- **Neon (serverless HTTP)** + pgvector (2000-dim cap). Dynamic sayfalar
  DB-backed; marketing sayfaları edge-cache (statik prerender).
- **Idempotency + idempotent upsert** (Paddle sub/customer, API key, sourceRef,
  api_idempotency) — retry/tekrar eşlerinde duplike yok.
- **Vercel Hobby** — kayan ~100 deploy/24s limit; commit biriktirip tek push.
- **İzleme:** Sentry (DSN), Vercel Analytics; henüz özel alert/kaynak-uyarı yok.

### Takas analizi & yeniden bakılacaklar
| Karar | Takas | Yeniden bak |
|---|---|---|
| Next.js monolit (API + UI bir arada) | hız/tek repo vs modüler ölçek | AI/worker ağırlaşınca servise böl |
| Clerk kimlik, Neon iş/tenant verisi | basit, tek kaynak | Clerk Organizasyon senkronu (bilinçli DEĞİL — 2026-09-07) |
| Ücretsiz OpenRouter model | maliyet 0 vs kalite/flakiness | `LLM_FALLBACK_MODEL`; ücretli modele geçiş |
| Paddle merchant-of-record | vergi basitliği vs marj | canlıya geçildi (live) — tax/fiyat kontrol |
| `@paddle/paddle-js` v1.6.5 | overlay zorunlu (inline frameTarget bozuk) | v2 upgrade |

## Teknik Borç (`tech-debt` çıkarımı)

Öncelik = (Etki + Risk) × (6 − Efor). **Efor ters**: 1 = kolay/az → yüksek öncelik.

| # | Başlık | Tür | Etki | Risk | Efor | Öncelik |
|---|--------|-----|:---:|:---:|:---:|:---:|
| 1 | `/api/paddle/*` 404 — route sadece middleware auth'una takılıyordu (DÜZELTİLDİ: public matcher + handler auth) | Mimari | 5 | 5 | 1 | 20 |
| 2 | Başlık/description her sayfada aynı default'a düşüyordu (DÜZELTİLDİ: benzersiz title+canonical) | İçerik/SEO | 4 | 4 | 1 | 16 |
| 3 | Billing association `slug`→`workspace_id` (DÜZELTİLDİ: checkout custom_data workspace_id, webhook UUID-first) | Mimari | 4 | 4 | 2 | 16 |
| 4 | Billing activation `setTimeout(reload)` yarışı (DÜZELTİLDİ: `/api/paddle/status` poll) | Kod | 4 | 3 | 2 | 14 |
| 5 | Önceden yapılmış çoğaltılmış checkout/nav/rozet (tek kaynaklar oluşturuldu) | Kod | 3 | 3 | 1 | 12 |
| 6 | `@paddle/paddle-js` v1.6.5 inline frameTarget bozuk → overlay | Bağımlılık | 3 | 3 | 3 | 10 |
| 7 | Sentry `onRequestError`/global-error uyarısı + Clerk `createRouteMatcher` deprecated | Bağımlılık | 2 | 3 | 2 | 10 |
| 8 | Test: DB-backed/E2E sunucu + seed gerektiriyor; CI push'ta build ama e2e env'siz | Test | 3 | 2 | 3 | 10 |
| 9 | README/mimari belgelerdeki eskimiş satırlar (Paddle sandbox, 98 test, Canny karşılaştırması) | Dokümantasyon | 2 | 2 | 1 | 8 |
| 10 | Entegrasyon webhook'ları `?ws=&t=` URL token'a bağlı; token yoksa 403 (Intercom webhook için doğrulanmamış kanal) | Mimari | 2 | 3 | 3 | 8 |
| 11 | Özel `getWorkspaceId` (host/cookie/widget) — tenant izolasyonu tek testle sunucu kanıtı eksik | Mimari | 2 | 3 | 4 | 6 |

### Fazlı (feature ile paralel) iyileştirme planı
- **Faz 1 (bu hafta, küçük):** README/mimari doğruluğu (#9), orta ve düşük borçların kapatılması — kod/içerik düzeltmeleri zaten commit'li. `tsc`/`vitest` (111) yeşil.
- **Faz 2 (bu çeyrek):** `@paddle/paddle-js` v2 upgrade (#6), Sentry/Clerk deprecation temizliği (#7), e2e için CI env + test seed (#8).
- **Faz 3 (sonra):** Servise bölme / ölçek (#1 takas), custom-domain + ikinci tenant'la gerçek çok kiracılı kanıt (#11).

## Lisans

Ticari SaaS — özel repo. (Bkz. `docs/plan.md` · `DESIGN.md` · `docs/standarts.md`.)
