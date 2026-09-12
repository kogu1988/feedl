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
5. **Ekip & Roller:** Owner / Manager / Member (3 kademe) — kısmi dashboard
   erişimi, iç notlar (private). `admin` adı ileride feedl'in iç yönetim paneli
   için ayrılmıştır.
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
| AI | OpenRouter (LLM `amazon/nova-micro-v1` → fallback `mistralai/mistral-nemo`, embedding `nemotron-3-embed-1b:free`) |
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
- Resend: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- Widget: `FEEDL_WIDGET_SECRET`, `FEEDL_WIDGET_ALLOWED_ORIGINS`
- Paddle: `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Sentry: `SENTRY_DSN` (opsiyonel; DSN yoksa no-op)
- Analytics: `NEXT_PUBLIC_GA_ID` (opsiyonel; GA4 measurement ID ör. `G-XXXX`; setliyse gtag yüklenir, değilse no-op — Vercel Analytics zaten var)
- Şifreleme: `ENCRYPTION_KEY` (entegrasyon secret AES-256-GCM; prod'da zorunlu)
- AI: `LLM_MODEL`, `LLM_FALLBACK_MODEL` (ücretsiz flaky olursa ücretli fallback)
- App: `NEXT_PUBLIC_APP_URL`

Gizli değerler yalnız `.env.local`'de — repo'ya yazılmaz.

### Vercel ortamları (Production / Preview / Development)

Preview ortamı **fonksiyonel olarak tamdır** (kimlik, DB, Paddle, AI, e-posta,
Upstash, Sentry, widget, `ENCRYPTION_KEY`). Anahtar başına tip TUTARLI tutulur
(`vercel env ls` ile denetlenebilir) — aynı anahtarın bir ortamda Secret,
başkasında Config olması "needs attention" uyarısı üretir.

Preview'a **bilinçli olarak eklenmeyenler**: inbound webhook sırları
(`PADDLE_/CLERK_/RESEND_/LINEAR_/ZENDESK_/SLACK_` + `JIRA_*`, `INTERCOM_*`).
Preview deploy'larına hiç uğramazlar; sırları gereksiz yere başka bir ortama
yaymak doğru değildir.

Notlar:
- Preview'daki `DATABASE_URL` **üretim veritabanını** gösterir (izole bir Neon
  branch'i değil). Güçlü izolasyon istersen Preview için ayrı bir Neon branch
  oluşturup `DATABASE_URL`'i ona çevir.
- Preview'ın `ENCRYPTION_KEY`'i **üretimden farklı** (preview'a özel üretildi):
  Preview üretim entegrasyon sırlarını çözemez — entegrasyon özelliği zaten
  Preview'da kullanılamaz (connector kimlikleri de orada yok).
- `vercel env pull` (varsayılan Development) artık `DATABASE_URL` ve
  `CLERK_SECRET_KEY` için `[SENSITIVE]` yazar (ikisi de Secret) — gerçek
  değerler `.env.local`'de zaten mevcut.
- `INTERCOM_WEBHOOK_SECRET` **hiçbir ortamda yok ve gerekmiyor**: Intercom
  webhook'ları imza başlığı göndermez, birincil doğrulama `INTERCOM_APP_ID`
  eşleşmesidir (secret yalnız opsiyonel alternatif).

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
>    `node tools/seed-e2e.mjs "test+clerk_test@example.com" feedl`
>    (takipli betik — workspace/board eksikse kendisi oluşturur; e-postayı
>    gerçek fake e-postasıyla değiştir).
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
| `/api/admin/*` | Clerk + rol | owner/manager/member kademesi |
| `/api/v1/*` | Bearer API key (`fk_live_`) | `Idempotency-Key`, rate-limit
| `/api/webhooks/{paddle,clerk,slack,...}` | HMAC/imza | at-least-once, idempotent |
| Workspace çözümü | host / subdomain / custom-domain / widget-session | `getWorkspaceId` |

### Depolama & ölçek/güvenilirlik
- **Neon (serverless HTTP)** + pgvector (2000-dim cap). Dynamic sayfalar
  DB-backed; marketing sayfaları edge-cache (statik prerender).
- **Idempotency + idempotent upsert** (Paddle sub/customer, API key, sourceRef,
  api_idempotency) — retry/tekrar eşlerinde duplike yok.
- **Vercel Hobby** — kayan ~100 deploy/24s limit; commit biriktirip tek push.
- **İzleme:** Sentry (DSN) + Vercel Analytics. AI hattı `area=llm` etiketiyle
  raporlanır (`lib/ai/openrouter.ts` → `reportLlmFailure`): model zinciri tükenirse
  ya da embedding modeli düşerse Sentry'de issue açılır.
  **Uçtan uca kanıtlandı (2026-09-12):** `tools/prove-ai-alert.mjs` ile üretimde
  tetiklenen arıza Sentry'ye `FEEDL-4` olarak düştü (`culprit: POST /api/inngest`),
  `issue.priority:high` oldu ve mevcut "Send a notification for high priority
  issues" kuralı (807520) tetiklendi — e-posta alındı. Yani **uygulama çalışma
  zamanından yakalama çalışıyor** ve AI arızası sessiz kalmıyor (önceki şüphe:
  90 günde uygulamadan hiç olay gelmemişti; bunun nedeni arıza olmamasıydı).
  Ek olarak `area:llm`'e özel, 30 dk throttle'lı bağımsız bir kural için
  `tools/create-llm-alert.mjs` hazırdır (Vercel'deki `SENTRY_AUTH_TOKEN` yalnız
  source-map yetkili → 403; kural, `alerts:write` scope'lu `SENTRY_API_TOKEN` ile
  ya da Sentry UI'dan kurulur).
- **Embedding girdi tavanı (2026-09-12):** embedding modeli **4096 token**'da 422
  döner ve OpenRouter'ın `truncate` parametresini yok sayar (canlı ölçüm) — bu
  yüzden uzun bir geri bildirim tüm AI zenginleştirmesini (özet/triage/etiket/
  benzerlik) düşürüyordu. `capEmbeddingInput` (7000 karakter, PII maskesinden
  SONRA) ile kırpılır. Ölçüm: `tools/probe-embedding-limit.mjs`.

### Takas analizi & yeniden bakılacaklar
| Karar | Takas | Yeniden bak |
|---|---|---|
| Next.js monolit (API + UI bir arada) | hız/tek repo vs modüler ölçek | AI/worker ağırlaşınca servise böl |
| Clerk kimlik, Neon iş/tenant verisi | basit, tek kaynak | Clerk Organizasyon senkronu (bilinçli DEĞİL — 2026-09-07) |
| Chat: ücretli küçük modeller (nova-micro + mistral-nemo), embedding: ücretsiz | kararlılık vs ~$0.0001/çağrı | `LLM_MODEL`/`LLM_FALLBACK_MODEL` env; `tools/probe-llm-models.mjs` |
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
| 7 | Sentry `onRequestError` + `global-error` YOKTU → sunucudaki yakalanmayan hatalar Sentry'ye HİÇ düşmüyordu (90 günde uygulamadan tek otomatik olay yok) ve markasız/İngilizce hata sayfası çıkıyordu (DÜZELTİLDİ: `instrumentation.ts` → `onRequestError` + `app/global-error.tsx`, satır içi stille — kök layout yerine geçtiği için Tailwind'e güvenilmez) | Bağımlılık | 3 | 4 | 1 | 35 |
| 8 | Test: DB-backed/E2E sunucu + seed gerektiriyor; CI push'ta build ama e2e env'siz | Test | 3 | 2 | 3 | 10 |
| 9 | README/mimari belgelerdeki eskimiş satırlar (Paddle sandbox, 98 test, Canny karşılaştırması) | Dokümantasyon | 2 | 2 | 1 | 8 |
| 10 | Entegrasyon webhook'ları `?ws=&t=` URL token'a bağlı; token yoksa 403 (Intercom webhook için doğrulanmamış kanal) | Mimari | 2 | 3 | 3 | 8 |
| 11 | Özel `getWorkspaceId` (host/cookie/widget) — tenant izolasyonu tek testle sunucu kanıtı eksik | Mimari | 2 | 3 | 4 | 6 |
| 12 | Embedding girdisi 4096 token sınırını aşınca TÜM AI zenginleştirmesi düşüyordu (DÜZELTİLDİ: `capEmbeddingInput`, 7000 karakter; 2026-09-12'de canlı provada bulundu) | Kod | 3 | 2 | 1 | 25 |
| 13 | Sentry `LLM pipeline failure` ÖZEL kuralı henüz kurulmadı — **acil DEĞİL, uyarı zaten çalışıyor** (mevcut "high priority issues" kuralı 807520 canlı provada tetiklendi: FEEDL-4, `culprit POST /api/inngest`). Ek kural yalnızca sağlamlaştırma: `area=llm` kapsamasını açıkça belgeler + önceliği düşmüş tekrarlayan arızaları da yakalar. Kurulum: `node tools/create-llm-alert.mjs --apply` (`alerts:write` scope'lu `SENTRY_API_TOKEN` gerekir) ya da Sentry UI'dan 1 dakikada | Operasyon | 1 | 2 | 1 | 15 |

**2026-09-12 kod incelemesi (`docs/codereview.md`) — kapatılanlar.** Satır 12-19 sonradan eklendiği için tablo puana göre sıralı değildir.

| # | Başlık | Tür | Etki | Risk | Efor | Öncelik |
|---|--------|-----|:---:|:---:|:---:|:---:|
| 14 | Linear webhook'ta `workspaceIdOverride` MODÜL seviyesindeydi ve hiç sıfırlanmıyordu → warm instance'ta sonraki istek önceki kiracının workspace'ine yazıyordu (DÜZELTİLDİ: fonksiyon-lokal `resolvedWorkspaceId` + gerçekten kırmızıya düşen regresyon testi) | Mimari | 5 | 5 | 1 | 50 |
| 15 | `webhookEndpoints.secret` DB'de düz metin (DÜZELTİLDİ: `encryptSecret`/`decryptSecret`; eski düz satırlar geçiş uyumlu, çözülemeyen satır atlanır) | Güvenlik | 4 | 4 | 2 | 32 |
| 16 | Gelen entegrasyon webhook'larında (Linear/Jira/Zendesk/Slack/Intercom) hiç rate limit yoktu (DÜZELTİLDİ: `enforceInboundWebhookRateLimit`, 300/dk/IP, imza doğrulamasından ÖNCE) | Güvenlik | 3 | 3 | 1 | 30 |
| 17 | `ENCRYPTION_KEY` yoksa secret'lar SESSİZCE düz metne düşüyordu (DÜZELTİLDİ: tek seferlik `Sentry.captureMessage`, `area=encrypt`) | Güvenlik | 3 | 3 | 1 | 30 |
| 18 | Custom domain: biçim doğrulaması yoktu, sahiplik doğrulanmıyordu, unique değildi → hostname squatting (DÜZELTİLDİ: normalize+validasyon, `_feedl.<domain>` TXT doğrulaması, unique index; migration `0056`) | Mimari | 4 | 4 | 3 | 24 |
| 19 | Paddle webhook: `as` cast'leri, kullanılmayan şema, içi boş `transaction.completed` dalı, bayat yorum (DÜZELTİLDİ: patlamayan zod şeması + ölü kod/ yorum temizliği) | Kod | 2 | 2 | 2 | 16 |
| 20 | **BEKLİYOR — custom domain TXT akışının canlı uçtan uca testi.** Kod + migration (0056) canlıda; negatif yollar (biçim/rezerve host reddi, "DNS yok" hatası, doğrulanmamış alanın host çözümlemesinde yok sayılması) denenebilir. HAPPY PATH (doğrulandı → portal o adreste) için **DNS'ini bizim yönettiğimiz bir alan** gerekiyor. `test.feedl.app` KULLANILAMAZ: `feedl.app` + alt alanları koda gömülü rezerve (TXT eklenemez; o senaryo zaten slug routing ile `test.feedl.app` → slug `test`). Test: `feedback.<alan>` yaz → panelde çıkan TXT'i ekle (`_feedl.feedback.<alan>` = `feedl-verify=<token>`) → **Doğrula** → portal o alana düşmeli. Sahibi olunmayan bir alanla (ör. `feedback.ornek.com`) yalnız negatif yollar denenir ve test sonrası alan **KALDIRILMALI** (unique index gerçek sahibini bloklar). Yayılım kontrolü: `node:dns` `resolveTxt`. | Operasyon | 2 | 3 | 1 | 25 |
| 21 | Clerk `createRouteMatcher` DEPRECATED (v8'de kalkacak) ve gerekçesi tam da bu repoda 3 kez bug üreten sınıf: "path matching … leave protected resources reachable". Savunma derinliği eklendi (`dashboard/layout.tsx` → `auth.protect()`); `/onboarding` zaten kendi guard'ına sahip, `/api/{admin,comments,corpus-insights,invites,onboarding,votes}` handler'ları da kendi auth'unu yapıyor. **KALAN:** bu 6 namespace'in ALT rotalarını tek tek denetleyip (handler auth'u olmayan bir GET var mı?) middleware matcher'ı kaldırmak — o zaman `createRouteMatcher` tamamen gider. | Bağımlılık | 3 | 3 | 3 | 18 |

### Fazlı (feature ile paralel) iyileştirme planı
- **Faz 1 (bu hafta, küçük):** README/mimari doğruluğu (#9), orta ve düşük borçların kapatılması — kod/içerik düzeltmeleri zaten commit'li. `tsc`/`vitest` (189) yeşil.
- **Faz 2 (bu çeyrek):** `@paddle/paddle-js` v2 upgrade (#6), e2e için CI env + test seed (#8), Clerk `createRouteMatcher`'ın kaldırılması (#21 — alt rota denetimi sonrası), custom domain için gerçek DNS uçtan uca denemesi (#20 — farklı bir alanla, DNS'i bizde olan).
- **Faz 3 (sonra):** Servise bölme / ölçek (#1 takas), ikinci tenant'la gerçek çok kiracılı kanıt (#11), eski global webhook secret'larının (`LINEAR_WEBHOOK_SECRET` vb.) emekliye ayrılması — per-workspace `?ws=&t=` yolu varken global secret tek sızıntı noktası.

## Lisans

Ticari SaaS — özel repo. (Bkz. `docs/plan.md` · `DESIGN.md` · `docs/standarts.md`.)
