# feedl — AI Destekli Müşteri Geri Bildirim Platformu

feedl, ürün ekiplerinin müşteri geri bildirimini toplaması, **AI ile analiz etmesi**,
önceliklendirmesi ve duyurması için tek bir platformdur. Hosted ve ücretsiz
başlangıç — herkese açık bir topluluk portalı + gelir odaklı önceliklendirme.

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
   markası (logo/renk/domain), kendi board'ları. Üyeliği olan kullanıcı
   dashboard'dan **aktif workspace'i seçer** (`/dashboard/workspaces` → "Geç");
   o andan sonra ayarlar/veri/silme işlemleri o workspace'i hedefler. Aktif
   seçim `feedl_active_ws` çerezinde tutulur — bu çerez bir YETKİ BARIYERİ
   değil, yalnız routing ipucudur (yetki her istekte üyelikten doğrulanır).
   **Free hesap 1 workspace** ile sınırlıdır (Pro'da sınırsız); liste yalnız
   üye olduğun workspace'leri gösterir.
8. **Public API + Webhook:** HMAC-SHA256 imzalı olaylar, anahtar erişimi.
9. **Görsel geri bildirim & teknik bağlam:** Kullanıcı sayfada sorunlu noktayı
işaretler (pin); cihaz/viewport/tarayıcı/OS otomatik eklenir, ekran görüntüsü
alınır (private Blob). Adminde cihaz filtresi (Masaüstü/Tablet/Mobil).
10. **AI triage öğrenmesi:** Admin bir fikri "ilgisiz" işaretler ya da AI'nın
türünü düzeltir → workspace-scoped sinyaller sonraki sınıflandırmayı yönlendirir.
11. **Haftalık AI özeti (digest):** Pazartesi sabahı Pro workspace'ler için
korpus analizi yeniden üretilir; yeni geri bildirim varsa admin'lere tema/risk/
hızlı kazanım özeti e-posta olarak gider (tek tıkla kapatılabilir).
12. **Sonuç kaydı (outcome):** Yayına giren bir fikrin **gerçekleşen** sonucu
kaydedilir (genişleme / elde tutma / verimlilik / yeni müşteri + aylık gelir
etkisi + kanıt linki). Önceliklendirme böylece yalnız tahmine değil, geçmiş
sonuç verisine de dayanır ("ne yaptık?" → "işe yaradı mı?"). Kayıt içseldir
(müşteriye görünmez); **yazma Pro**, okuma/silme her admine açık — Pro
bırakılınca kendi verisine erişememek veri kilidi tuzağı olurdu. Ayrı tablo
seçildi (tek kolon değil): aynı fikir zaman içinde birden fazla sonuç
üretebilir; birikim `migrations/0060_post_outcomes.sql`.

## Farklılaşma (neden feedl?)

| | Yaygın SaaS aracı (ücretli Pro) | Self-host araç | **feedl** |
|---|---|---|---|
| Hosted + hızlı kurulum | ✅ | ❌ (self-host) | ✅ |
| AI analiz (etiket/özet/duygu) | ✅ | ⚠️ | ✅ |
| Gelir/opportunity skoru | ✅ | ❌ | ✅ |
| Public API + Webhook | ✅ | ⚠️ | ✅ |
| Fiyat | pahalı | ücretsiz+operasyon | **uygun, hosted** |

**Konum:** *"AI + gelir zekası, self-host derdi olmadan, uygun fiyata."*

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
Belirli bir rakip markayı ADIYLA anma veya kötüleme (marka adı taşıyan
karşılaştırma yasal risk); son kullanıcı
yüzeyinde webhook/API jargonu kullanma.

## Fiyatlandırma (bkz. `pricing/page.tsx` · `components/custom/plan-config.ts`)

- **Free:** 1 workspace · 1 board · 1 üye · 50 takipçi · "Powered by feedl" rozeti.
- **Pro:** Sınırsız workspace & board · 10 üye · özel domain · marka kaldırma ·
  sonuç kaydı (outcome). Aylık/yıllık.
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
npx tsc --noEmit  # tip kontrolü
npm run lint      # ESLint
npx vitest run    # 315 birim testi
npm run build     # üretim derlemesi
npm run test:e2e  # Playwright + axe erişilebilirlik + auth akışı (çalışan sunucu gerekir)
```

### Test durumu (2026-09-12)

| Katman | Sonuç | Kapsam |
| :--- | :--- | :--- |
| **Birim test** (`npm test`) | ✅ 48 dosya · **315 test geçti** | Saf mantık: renk/WCAG, sayfalama, CSV, şifreleme, rate-limit, Paddle imza+plan türetme, **hesap düzeyi Pro devralma kararı**, oy doğrulama, post-format, outcome kaydı (gelir ayrıştırma/biçimleme + API şeması), **workspace oluşturma limiti (Free 1 workspace)**, data-export kapsamı/redaksiyonu, post-search, widget-origins, widget gömme (body-bekleme), workspace-host çözümleme, **fail-closed host politikası**, AI içgörüleri, OpenRouter modelleri, e-posta teslimatı, haftalık digest e-postası + gönderim kararı, api-keys, davet e-postası, widget gönderim modu, free-plan oy limiti, **entegrasyon URL token doğrulaması**, **Linear webhook tenant izolasyonu**, **`getWorkspaceId` önceliği**, **middleware public allowlist'i** |
| **Tenant izolasyonu** | ✅ `resolveWorkspaceByHost` öncelik (custom_domain > subdomain > varsayılan) + hata; `getWorkspaceId` sırası (widget > çerez > host) + modül-global önbellek regresyonu; **fail-closed host kapısı**: bilinmeyen alt alan/doğrulanmamış custom domain → null (404), kök host + `*.vercel.app` + loopback → varsayılan | `tests/lib/tenant-isolation.test.ts`, `tests/lib/workspace-precedence.test.ts`, `tests/lib/host-fallback-policy.test.ts`, `e2e/host-isolation.spec.ts` |
| **Entegrasyon webhook token** | ✅ Zaman-sabit karşılaştırma; yanlış/boş/eksik token → null (handler 403); legacy (token'sız) yol **emekliye ayrıldı** → 403 | `tests/lib/integration-url-token.test.ts`, `tests/lib/linear-webhook-tenant.test.ts` |
| **Middleware yetki yüzeyi** | ✅ Açık allowlist fail-closed; önek sızması yok (`/api/adminx` kapalı); `/dashboard` + `/onboarding` korunur | `tests/lib/public-paths.test.ts` |
| **Paddle plan türetme** | ✅ `derivePlanFromStatus` (trialing/active→pro; canceled/past_due/dunned→free; unknown→null) | `tests/lib/paddle-plans.test.ts` |
| **Merge/unmerge karar mantığı** | ✅ Şema doğrulama (uuid, self-merge) + reason→HTTP eşleme | `tests/lib/post-merge.test.ts` |
| **Entegrasyon secret şifreleme** | ✅ `saveIntegration` + Linear connect `encryptSecret` (AES-256-GCM); okuma `decryptSecret` (düz eski satırlar backward-compat) | `tests/lib/encrypt.test.ts` |
| **E2E smoke** (`test:e2e`) | ✅ CI'da GERÇEKTEN koşar (`e2e` job'u, `DATABASE_URL` secret'ı tanımlı): **32 passed / 3 skipped**. Landing testi host-aware — CI'da `NEXT_PUBLIC_APP_URL=localhost` olduğu için GERÇEK landing doğrulanır. **Host izolasyonu** (`e2e/host-isolation.spec.ts`) gerçek 404 statüsünü, robots/sitemap kapatmasını ve kök-host markının `feedl` kaldığını doğrular | Ana yüzeyler + public API yüzeyi (OpenAPI, v1 401 gate) + axe a11y |
| **E2E auth akışı** | ⚠️ Gerçek Clerk test env + seed gerekir; yoksa otomatik atlanır (3 skip). **CI'daki sahte Clerk anahtarı bilinçli olarak `pk_live_`'dir** ve formatı geçerlidir: dev (`pk_test_`) anahtarı middleware'i her istekte dev-browser handshake'ine zorlar, sahte instance 400 döner ve sayfa gövdesi Clerk JSON'u olarak kalır; `pk_live_` yolu handshake yapmaz. Sebep `ci.yml`'de ayrıntılı yazılı | Admin dashboard erişimi + portal fikir oluşturma |

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
| `@paddle/paddle-js` v1.6.5 (**en güncel sürüm — v2 YOK**) | overlay kullanıyoruz; inline 1.6.5'te destekli ama canlı doğrulanmadı | inline'a geçiş bir ÜRÜN kararı, sürüm işi değil |

## Teknik Borç (`tech-debt` çıkarımı)

Öncelik = (Etki + Risk) × (6 − Efor). **Efor ters**: 1 = kolay/az → yüksek öncelik.

| # | Başlık | Tür | Etki | Risk | Efor | Öncelik |
|---|--------|-----|:---:|:---:|:---:|:---:|
| 1 | `/api/paddle/*` 404 — route sadece middleware auth'una takılıyordu (DÜZELTİLDİ: public matcher + handler auth) | Mimari | 5 | 5 | 1 | 20 |
| 2 | Başlık/description her sayfada aynı default'a düşüyordu (DÜZELTİLDİ: benzersiz title+canonical) | İçerik/SEO | 4 | 4 | 1 | 16 |
| 3 | Billing association `slug`→`workspace_id` (DÜZELTİLDİ: checkout custom_data workspace_id, webhook UUID-first) | Mimari | 4 | 4 | 2 | 16 |
| 4 | Billing activation `setTimeout(reload)` yarışı (DÜZELTİLDİ: `/api/paddle/status` poll) | Kod | 4 | 3 | 2 | 14 |
| 5 | Önceden yapılmış çoğaltılmış checkout/nav/rozet (tek kaynaklar oluşturuldu) | Kod | 3 | 3 | 1 | 12 |
| 6 | **ÖNCÜL YANLIŞ (2026-09-12 doğrulandı):** "`@paddle/paddle-js` v2 upgrade" diye bir iş YOK — `npm view` `latest` = **1.6.5** (2026-08-25), zaten kurulu; `dist-tags` yalnız `latest` / `beta` (0.0.5) / `next` (1.6.3-next.0), paket deprecated değil. "inline `frameTarget` bozuk" teşhisi de yanlıştı: inline 1.6.5'te DESTEKLİ (`initializePaddle({ checkout: { settings: { displayMode: "inline", frameTarget, frameInitialHeight: 450, frameStyle } } })`; kurulu tipler `frameTarget`/`frameInitialHeight`/`frameStyle`'ı içeriyor, Paddle dokümanı da bunları inline için zorunlu/önerilen sayıyor). Yani gerçek durum "sürüm eski" değil, "inline hiç denenmemiş". **Kapatıldı: yapılacak bağımlılık işi yok.** Inline'a geçiş istenirse ayrı bir ürün işi olarak açılmalı (kapsayıcı `<div>`, `checkout.loaded`/`checkout.updated` ile dinamik yükseklik, gerçek kartla canlı doğrulama) — overlay canlıda çalışıyor. | Bağımlılık | 2 | 2 | 1 | 10 |
| 7 | Sentry `onRequestError` + `global-error` YOKTU → sunucudaki yakalanmayan hatalar Sentry'ye HİÇ düşmüyordu (90 günde uygulamadan tek otomatik olay yok) ve markasız/İngilizce hata sayfası çıkıyordu (DÜZELTİLDİ: `instrumentation.ts` → `onRequestError` + `app/global-error.tsx`, satır içi stille — kök layout yerine geçtiği için Tailwind'e güvenilmez) | Bağımlılık | 3 | 4 | 1 | 35 |
| 8 | Test: DB-backed/E2E sunucu + seed gerektiriyor; CI push'ta build ama e2e env'siz (DÜZELTİLDİ: `ci.yml`'e koşullu `e2e` job'u — `DATABASE_URL` secret'ı yoksa yeşil no-op, varsa seed + build + `npm run test:e2e`; seed `tools/seed-e2e.mjs` olarak takipli, workspace/board'u kendisi kuruyor ve dolu workspace'e `--force` olmadan yazmıyor. Ayrıca `isFeedlRootHost` port'u yok saymıyordu → `NEXT_PUBLIC_APP_URL=http://localhost:3000` iken `/` landing yerine portal render ediyordu, landing e2e'de hiç koşamıyordu; düzeltildi) | Test | 3 | 2 | 1 | 25 |
| 9 | README/mimari belgelerdeki eskimiş satırlar (Paddle sandbox, 98 test, karşılaştırması) (DÜZELTİLDİ 2026-09-12: test sayısı tablosu güncel, "Paddle sandbox" iddiası kalmadı — canlıya geçildi. **Ayrıca marka adı taşıyan karşılaştırma sayfası kaldırıldı:** rota `/alternative` oldu, içerik araç-bağımsız; eski yol next.config.ts'te 308 ile devrediliyor) | Dokümantasyon | 2 | 2 | 1 | 8 |
| 10 | Entegrasyon webhook'ları `?ws=&t=` URL token'a bağlı; token yoksa 403 (Intercom webhook için doğrulanmamış kanal) (DÜZELTİLDİ: paylaşılan `resolveIntegrationByUrlToken` + yeni `urlTokenMatches` ile token karşılaştırması **zaman-sabit** (`timingSafeEqual`; repoda widget JWT'si de böyle); boş/kayıtsız token asla eşleşmez. **Legacy (token'sız) yol 2026-09-12 (Faz 3) itibarıyla EMEKLİYE AYRILDI:** 5 handler da `?ws=&t=` ZORUNLU tutar, eksikse 403 döner; global env secret'a düşen tek sızıntı noktası kapandı. Emeklilik ölçümle verildi (90 günde Sentry'de `area=integrations` yok, bağlı entegrasyon 0). `warnLegacyInboundWebhook` + `isLinear/Slack/Intercom/ZendeskConfigured` + `verifyLinearSignature` kaldırıldı; Slack/Intercom'da env'e düşen nullable fallback de kapatıldı. `JIRA_WEBHOOK_SECRET` KALIR (register route kullanıyor). Testler: `tests/lib/integration-url-token.test.ts` (10) + `tests/lib/linear-webhook-tenant.test.ts` (4) | Mimari/Güvenlik | 2 | 3 | 2 | 16 |
| 11 | Özel `getWorkspaceId` (host/cookie/widget) — tenant izolasyonu tek testle sunucu kanıtı eksik (DÜZELTİLDİ: `tests/lib/workspace-precedence.test.ts` (7) öncelik sırasını sunucu tarafında sabitler — widget oturumu > `feedl_active_ws` çerezi > host (doğrulanmış custom domain → subdomain slug → varsayılan); bilinmeyen slug sonraki sinyale düşer. Ayrıca modül-global önbellek REGRESYON testi: ardışık iki istek birbirinin workspace'ini devralamaz — bu repoda Sprint 63w'de tam olarak bu sınıf bug yaşanmıştı) | Mimari | 2 | 3 | 2 | 14 |
| 12 | Embedding girdisi 4096 token sınırını aşınca TÜM AI zenginleştirmesi düşüyordu (DÜZELTİLDİ: `capEmbeddingInput`, 7000 karakter; 2026-09-12'de canlı provada bulundu) | Kod | 3 | 2 | 1 | 25 |
| 13 | Sentry `LLM pipeline failure` ÖZEL kuralı (KAPATILDI 2026-09-12 — **gerek yok, kapsam zaten var ve canlı kanıtlı**). Canlı doğrulama (Sentry API, `kogu/feedl`): iki issue kuralı **enabled** — 807520 "Send a notification for high priority issues" ve 819505 "Notify Suggested Assignees"; 807520 `lastTriggered` = **2026-09-12T08:54Z** (bugün), yani LLM smoke arızaları e-postayı gerçekten tetikledi (FEEDL-2/FEEDL-3 aynı pencerede oluşup `resolved`'a çekildi). Özel kural **kurulamaz ve kurulmasına gerek yok**: Sentry MCP kataloğunda yalnız `find_alert_rules`/`get_alert_rule` var (ikisi de **read-only**, create yok) ve `alerts:write` scope'lu token yalnız sende olabilir (`.env.local`'de yalnız `SENTRY_DSN` var; Vercel `SENTRY_AUTH_TOKEN` kaynak-harita yetkili). Ek kural yalnızca `area=llm` etiketini açıkça belgeleme + önceliği düşmüş tekrarları yakalama faydası taşır — istenirse `node tools/create-llm-alert.mjs --apply` ile (token verilince) 1 dakikada açılır | Operasyon | 1 | 2 | 1 | 15 |

**2026-09-12 kod incelemesi (`docs/codereview.md`) — kapatılanlar.** Satır 12-19 sonradan eklendiği için tablo puana göre sıralı değildir.

| # | Başlık | Tür | Etki | Risk | Efor | Öncelik |
|---|--------|-----|:---:|:---:|:---:|:---:|
| 14 | Linear webhook'ta `workspaceIdOverride` MODÜL seviyesindeydi ve hiç sıfırlanmıyordu → warm instance'ta sonraki istek önceki kiracının workspace'ine yazıyordu (DÜZELTİLDİ: fonksiyon-lokal `resolvedWorkspaceId` + gerçekten kırmızıya düşen regresyon testi) | Mimari | 5 | 5 | 1 | 50 |
| 15 | `webhookEndpoints.secret` DB'de düz metin (DÜZELTİLDİ: `encryptSecret`/`decryptSecret`; eski düz satırlar geçiş uyumlu, çözülemeyen satır atlanır) | Güvenlik | 4 | 4 | 2 | 32 |
| 16 | Gelen entegrasyon webhook'larında (Linear/Jira/Zendesk/Slack/Intercom) hiç rate limit yoktu (DÜZELTİLDİ: `enforceInboundWebhookRateLimit`, 300/dk/IP, imza doğrulamasından ÖNCE) | Güvenlik | 3 | 3 | 1 | 30 |
| 17 | `ENCRYPTION_KEY` yoksa secret'lar SESSİZCE düz metne düşüyordu (DÜZELTİLDİ: tek seferlik `Sentry.captureMessage`, `area=encrypt`) | Güvenlik | 3 | 3 | 1 | 30 |
| 18 | Custom domain: biçim doğrulaması yoktu, sahiplik doğrulanmıyordu, unique değildi → hostname squatting (DÜZELTİLDİ: normalize+validasyon, `_feedl.<domain>` TXT doğrulaması, unique index; migration `0056`) | Mimari | 4 | 4 | 3 | 24 |
| 19 | Paddle webhook: `as` cast'leri, kullanılmayan şema, içi boş `transaction.completed` dalı, bayat yorum (DÜZELTİLDİ: patlamayan zod şeması + ölü kod/ yorum temizliği) | Kod | 2 | 2 | 2 | 16 |
| 20 | **KOD TAMAM — custom domain'in TRAFİK yarısı uygulandı (2026-09-12), iki env değişkeni kaldı.** Sahiplik doğrulaması zaten vardı (biçim/rezerve host reddi, `_feedl.<domain>` TXT token'ı, doğrulanmamış alanın host çözümlemesinde yok sayılması, unique index — migration `0056`). EKlenen: `lib/vercel-domains.ts` (Vercel API istemcisi — `attachDomainToProject`, `detachDomainFromProject`, `ensureDomainTraffic`, `isVercelDnsTarget`) + `lib/dns-records.ts` (client-safe `CUSTOM_DOMAIN_CNAME_TARGET = cname.vercel-dns.com`) + ayarlar arayüzünde CNAME talimatı. Domain değiştirilirse ESKİ domain projeden ayrılır (yoksa bayat host varsayılan workspace'e düşer). `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` env'i yoksa özellik sessizce graceful degrade olur (domain eklenmez, ama TXT doğrulaması ve host eşleşmesi çalışır) → **iki env değişkeni Vercel'e eklenmeli** (`VERCEL_PROJECT_ID` = feedl projesinin id'si; token domain scope'lu olmalı). `test.feedl.app` KULLANILAMAZ (rezerve + slug routing); gerçek bir müşteri domainiyle uçtan uca provası hâlâ yapılmadı | Operasyon | 3 | 3 | 2 | 27 |
| 21 | Clerk `createRouteMatcher` DEPRECATED (v8'de kalkacak); gerekçesi tam da bu repoda 3 kez bug üreten sınıf: "path matching … leave protected resources reachable". Savunma derinliği eklendi (`dashboard/layout.tsx` → `auth.protect()`). **TAMAMEN KALDIRILDI (2026-09-12):** matcher yerine açık allowlist `lib/auth/public-paths.ts` (`isPublicPath`, **fail-closed**: listede yoksa korunur; önek eşleşmesi segment sınırında — `/api/adminx` açılmaz) + `tests/lib/public-paths.test.ts` (8). 6 namespace'in ALT rotaları tek tek denetlendi: her handler kendi auth'unu yapıyor (metod başına auth çağrısı sayıldı, eksiği yok). Namespace'ler allowlist'e alındı çünkü middleware `protect()`'i bu API'leri **Clerk 404'üne** çeviriyordu. Canlı kanıt (yerel `next start`, eski vs yeni middleware): `/api/admin/members` ve `/api/admin/webhooks` eski halde **404 text/html**, yeni halde **403 application/json**; `/dashboard` 404'ü (yerel Clerk sign-in yapılandırması) her iki sürümde AYNI → değişiklik korunan sayfa davranışını bozmadı | Bağımlılık | 3 | 3 | 2 | 24 |
| 22 | **Gelir bağlamı TENANT SIZINTISI** — `loadRevenueContexts` ve `loadCustomerCounts` sorguları `companies.workspace_id` ile filtrelenmiyordu: A workspace'indeki bir şirketin üyesi olan kullanıcı B workspace'indeki bir fikre oy verirse **A'nın şirketi ve MRR'i B'nin skoruna/sayacına sızıyordu** (DÜZELTİLDİ: iki sorguya da workspace filtresi; `tests/lib/post-impact.test.ts` filtresiz hâlde **kırmızıya düşüyor**) | Güvenlik/Mimari | 4 | 4 | 1 | 40 |
| 23 | İş etkisi (business impact) görünür değildi: post detayı yalnız "N müşteri oy verdi" gösteriyordu, skor çıplak bir sayıydı (DÜZELTİLDİ 2026-09-12: tek kaynak `loadPostImpactContexts` — etkilenen müşteri, müşteri MRR'i, bağlı **açık** fırsat, oy; `BusinessImpact` kutusu öncelik sinyali + **"Bu skor nasıl hesaplandı?"** breakdown'ı ile; `null` MRR ≠ `0` MRR; veri yoksa yönlendirici empty state, uydurma rakam yok. Admin roadmap'te de fikir başına `N oy · N müşteri · $X MRR`) | Ürün | 4 | 3 | 2 | 23 |
| 24 | Gelir bazlı sıralama yoktu — "en çok oy" ile "iş açısından en önemli" ayrılamıyordu (DÜZELTİLDİ 2026-09-12, frontend_plan P1-8: `?sort=votes\|impact` — **SQL'de** sıralanır, tüm liste JS'e çekilmez, sayfalama bozulmaz; `impact` yalnız Pro'da görünür çünkü skor sütunu da Pro). SQL ifadesi `computeRevenueScore` ile aynı formülü taşımalı → testle kilitlendi; ayrıca **canlı Postgres'te read-only çalıştırılıp** doğrulandı (`3 oy + 10×1 müşteri = 13`, `5000 fırsat ÷ 1000 = 5`) | Ürün | 3 | 2 | 3 | 15 |
| 25 | Dashboard'da talebin (oy) yanında iş etkisi özeti yoktu — "bu hafta ne istiyorlar ve hangisi iş açısından önemli?" sorusunun ikinci yarısı cevapsızdı (DÜZELTİLDİ 2026-09-12, frontend_plan P1-11: `AnalyticsOverview`'e **"Gelir etkisi en yüksek"** listesi — sıralama mevcut `revenueScoreOrderSql` ile **SQL'de**, yalnız en iyi 5 satır (`§33`); aynı ifade `?sort=impact` ile paylaşıldığı için liste sırası ile gösterilen skor ayrışamaz. **Pro'ya özel:** Free'de sorgu HİÇ koşmaz, `ProFeatureLock` şablonu çıkar. Skor çıplak sayı değil — bileşenleri (`N oy · N müşteri · $X MRR`) yanında; tam breakdown fikir sayfasında. "En çok istenenler" (talep) KORUNUR, ikisi ayrı gösterilir (`§13`) | Ürün | 3 | 2 | 2 | 20 |

### Fazlı (feature ile paralel) iyileştirme planı

> **Açık kalan işler (sonra tek tek) — tek liste.** Aşağıdakilerin hepsi kapatılmadı;
> 2026-09-12 itibarıyla durumları:

- **Faz 1 (bitti):** README/mimari doğruluğu (#9), orta ve düşük borçların kapatılması. `tsc` + `lint` + `vitest` (**287**) + `build` + e2e yeşil.
- **Faz 2 (bitti):** e2e için CI job + test seed (#8). Landing a11y ihlalleri (16) yakalanıp düzeltildi — host-aware test sayesinde mümkün oldu.
- **Ürün revizyonu (bitti, 2026-09-12):** `docs/frontend_plan.md` P0 + P1 — iş etkisi katmanı (#22 sızıntı düzeltmesi, #23 görünürlük/açıklanabilirlik), roadmap bağlamı, gelir bazlı sıralama (#24) ve dashboard'da gelir etkisi özeti (#25). `docs/frontend_plan.md` P2 (CSV müşteri import, CRM/Salesforce/HubSpot/Stripe) ve "DO NOT BUILD" listesi bilinçli olarak yapılmadı.
- **Faz 2 — kalan:**
  - **#20** custom domain — kod tamam (Vercel API + CNAME talimatı); **iki env değişkeni** (`VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`) eklenmeli, gerçek domainle uçtan uca provası yapılmalı. Ayrıntı: yukarıdaki #20 satırı.
  - **Uptime monitörü:** kullanıcı kararı — **gerekmiyor**, kapatıldı (`/api/health` yine de hazır ve DB'yi kontrol ediyor).
  - **Workspace silme akışının canlı provası:** artık yapılabilir — `/dashboard/workspaces` → workspace satırında **Geç** ile ona geç, sonra "Veri ve gizlilik" → sil. (Varsayılan `feedl` tasarım gereği silinemez; `deneme` silinebilir.) Hâlâ denenmedi.
  - **CSV müşteri import testi:** kullanıcı kararı — **ertelendi** (kod var, gerçek CSV ile koşulmadı).
  - **Resend `mail.feedl.app`:** kullanıcı kararı — **ertelendi** (gönderim tam sağlıklı; `partially_failed` yalnız kullanılmayan gelen MX kaydından).
  - **Bilinmeyen alt alan davranışı — ÇÖZÜLDÜ (2026-09-12, seçenek a).** `*.feedl.app` üzerinde var olmayan bir slug artık **404** döner; varsayılan workspace'e sessiz düşme kaldırıldı. Muafiyetler `lib/db/workspace.ts → isDefaultFallbackHost`: feedl kök host'ları, `*.vercel.app` preview'ları ve loopback (`localhost`/`127.0.0.1`/`::1` — yerel DX). Kapı `app/(main)/layout.tsx`'te `notFound()` ile: bilerek `getWorkspaceId`'in İÇİNDE değil, çünkü oradaki `catch {}` blokları (ör. `changelog/page.tsx`) `notFound()` hatasını yutar ve kırık sayfa render ederdi. Yan etkiler: (1) doğrulanmamış custom domain de artık varsayılana düşmez → gerçek bir sızıntı kapandı (`slugFromHost` yerine `subdomainSlugFromHost`, feedl dışı host'ta slug YOK); (2) `robots.txt`/`sitemap.xml` bilinmeyen host'ta taramayı tümüyle kapatır (`Disallow: /`, boş urlset, `X-Robots-Tag: noindex`) — bilinmeyen host kendini indeksletmeye davet etmez; (3) 404 sayfası host-aware: bilinmeyen host'ta göreli `/portal` bağlantıları da 404'e gideceği için kök siteye MUTLAK bağlantı verilir. Kanıt: `tests/lib/host-fallback-policy.test.ts` (14) + `e2e/host-isolation.spec.ts` (7 — gerçek 404 statüsü, robots/sitemap, kök host ve preview muafiyetleri); canlı probe: bilinmeyen host'ta `/`, `/pricing`, `/how-to-collect-feedback`, `/alternative`, `/terms`, `/portal`, `/roadmap`, `/changelog` **hepsi 404**. **Build-time nüans:** kapı gerçek istek host'u yoksa (build/prerender/test/cron) UYGULANMAZ — aksi halde statik üretim DB'ye muhtaç olur ve `npm run build` `DATABASE_URL` olmadan kırılır (2026-09-12'de CI'da tam olarak bu oldu; önceki hâlde hata `getWorkspaceBrand`'in `catch`'i tarafından yutuluyordu). Bu, `getRequestHostOrNull`'a geçmeyi gerektirdi; ayrıca `normalizeDomainForMatch` artık şema/path'i de soyar (env fallback'i `https://feedl.app` biçiminde dönebildiği için `isFeedlRootHost` bunu tanımıyordu).
- **Kapananlar (2026-09-12, denetim):** ~~CI `DATABASE_URL` secret'ı~~ → eklendi (ayrı Neon branch) ve `e2e` job'u gerçek koşuya döndü; ~~GDPR self-servis~~ → `GET /api/admin/data-export` (owner-only JSON, sırlar maskeli) + `DELETE /api/admin/workspace` (owner-only, slug onaylı, varsayılan workspace ve etkin Pro abonelik engelli) eklendi ve gerçek DB'de doğrulandı. Ayrıca: ~~`components/ui/toast.tsx` ölü iskelet~~ → **silindi**; ~~`router.refresh()` yeterli mi?~~ → **yeterli kabul edildi** ve kaynak tasarrufu için `experimental.staleTimes = { dynamic: 30, static: 300 }` eklendi (mutasyonlar `router.refresh()` çağırır → kendi değişikliğin hemen görünür; başkasının değişikliği ≤30s gecikebilir); ~~Free workspace limiti~~ → **kullanıcı sıkılaştırdı**: Free'de workspace sayısı **1** (`lib/db/workspace-limits.ts`: yalnız etkin Pro workspace sahibiysen ek workspace açabilirsin, dunning grace korunur); ~~`DATABASE_URL_UNPOOLED` `Config`~~ → **Sensitive'a çevrildi** (değer stdin ile taşındı; `--force` tipi değiştirmediği için sil+yeniden ekle; CLI'ın sondaki newline'ı kırptığı bir `FEEDL_STDIN_PROBE` ile doğrulandı).
- **HESAP DÜZEYİ PRO (2026-09-12, kullanıcı kararı).** Önceki davranış: etkin plan yalnız aktif workspace'in satırından okunuyordu, bu yüzden $19 abonesi owner olarak yeni bir workspace açtığında orada Free limitleri ve "Pro" kilitleri görüyordu ("CSV İndir · Pro"). Kural artık **bu workspace'in OWNER'larından birinin sahip olduğu başka bir workspace Pro ise bu workspace de Pro** (`lib/paddle.ts` → `resolveAccountPlanKey`); başkasının workspace'ine `member` olarak eklendiysen **devralma yok** (kararı oranın owner'ı verir). Kural "viewer" yerine "owner" üzerinden kuruldu: public sayfalar Clerk oturumu sormaz ve anonim ziyaretçide ek sorgu koşmaz; Free bir workspace'te bile yalnız **tek** ek sorgu (`lib/db/owned-workspaces.ts` → `loadPlanRowsOwnedByWorkspaceOwners`, self-join + alt sorgu; Pro'da hiç ek sorgu yok). Workspace açma sınırı aynı modülden beslenir, kopya sorgu yok. Test: `tests/lib/plan-account-entitlement.test.ts` (9).
- **Self-embed yüzey politikası + söküm (2026-09-12, kullanıcı kararı).** feedl'in KENDİ host'unda widget yalnız `/`, `/roadmap`, `/changelog`'da görünür (`lib/widget/embed.ts` → `SELF_EMBED_PATHS`, EXACT eşleşme); `/portal` ve `/dashboard*` **asla**. İki kapı sunucudaki çözücüde (`components/custom/feedl-widget-self-embed.tsx`): (1) `isShowcaseRequest()` host kapısı — müşteri subdomain/custom domain'lerinde sabit feedl workspace'i hedeflendiği için cross-tenant yazma olurdu, (2) `getTeamUserId()` oturum kapısı — girişli workspace üyesi (owner/manager/member) widget'ı **görmez** (operatör, geri bildirim kaynağı değil; widget'tan gönderirse kayıt anonim düşer). Canny/Featurebase/Intercom da "identified internal user → launcher gizle" uygular. **İki hata kapatıldı:** (a) widget düğümleri `document.body`'de React'in DIŞINDA yaşadığı ve widget.js silinirse `MutationObserver` ile geri koyduğu için, client-side gezinmede `/portal`/`/dashboard`'a gidilse bile balon "hayalet" olarak kalıyordu — artık yaşam döngüsü client'ta yönetiliyor (`components/custom/feedl-widget-embed.tsx` + `lib/widget/embed-client.ts`): izinli yüzeyler arasında gezinirken widget yerinde kalır (iframe yeniden yüklenmez), yüzeyden çıkışta sökülür; (b) `widget.js`'e **`destroy()`** eklendi ve "geri bağlama" observer'ı sonsuz değil **hidrasyon yarışı penceresiyle** (10 sn) sınırlandı — müşteri SPA'larında da hayalet balon kalmaz (`packages/feedl-widget` README'sinde belgelendi). Kanıt: `e2e/widget-interaction.spec.ts` → "self-embed yalnız beklenen yüzeylerde; çıkışta hayalet balon kalmaz".
- **MARKA KAPSAMI (2026-09-12, rakip standardı).** Header artık tek kurala bağlı: **kök host (feedl.app) → her zaman `feedl`** işareti ve workspace paleti UYGULANMAZ; **workspace host'u (subdomain/custom domain) → müşterinin adı/logo'su/rengi** (Canny/Featurebase/UserVoice/Fider standardı; satıcı yalnızca "Powered by"dır); **dashboard → feedl işareti + aktif workspace bağlamı** çip olarak (`/dashboard*`, işaretten farklıysa) — çünkü workspace geçişi çerezle yapılır ve URL `feedl.app` kalır, kullanıcı nerede olduğunu görmelidir. `isFeedlRootRequest()` istek bağlamı yoksa true döner (statik üretim feedl markasıyla). **Yan kazanç:** workspace marka rengi artık kök host'un CTA bölümüne uygulanmadığı için 3 pazarlama sayfasındaki `color-contrast` ihlali (feedl workspace `brand_color=#1e01f9`) ortadan kalktı — e2e a11y **tamamen yeşil** (önce 3 kırmızıydı). Ayrıca varsayılan workspace'in görünen adı "workspace" → "feedl" düzeltildi (`migrations/0061_default_workspace_name.sql` + `tools/apply-0061.mjs`, üretime uygulandı). Test: `e2e/host-isolation.spec.ts` + `isFeedlRootRequest` birim testleri.
- **TTFB ölçümü (2026-09-12, canlı, 3 tur `curl -w time_starttransfer`):** `/` ~0.64–1.30s, `/portal` ~0.84–1.03s, `/api/health` 0.49–1.70s. Yapısal regresyon yok; Hobby cold start'ları baskın. 16→3 await refactor'ünün faydası ağırlıkla **tekrar/önbellekli** gezintide görünür (`staleTimes`), ilk yüklemede değil.
- **Faz 3:**
  - **#1** servise bölme / ölçek (monolit takası) — **bilinçli ertelendi**: AI/worker ağırlaşınca. Şu an monolit Hobby'de sorunsuz; erken bölme operasyonel maliyet getirir, fayda getirmez.
  - **#11** ikinci tenant'la gerçek çok kiracılı canlı kanıt. **Host düzeyi kanıtlandı (2026-09-12):** prod'da iki tenant var — `feedl` (pro) ve `deneme` (free, aynı owner). `deneme.feedl.app/portal` → 200, `feedl.app/portal` → 200, var olmayan `kesinlikleyok12345.feedl.app/portal` → **404** (fail-closed politika). Alt alan/slug çözümlemesi ve tenant satırları canlıda ayrışıyor. **Eksik olan İÇERİK düzeyi kanıt:** iki workspace de 0 fikir/aynı adlı board taşıdığı için HTML farkı oluşmuyor. Yapılacak: `deneme.feedl.app/portal`'dan bir test fikri gönder → `feedl.app/portal`'da görünmediğini doğrula (tek tarayıcı adımı; sonrasında sunucudan teyit edilebilir).
  - ~~Eski global webhook secret'larının emekliliği~~ → **YAPILDI** (#10 satırı): 5 handler `?ws=&t=` zorunlu, legacy yol 403; `warnLegacyInboundWebhook` ve kullanılmayan config helper'ları kaldırıldı. Vercel'deki `LINEAR_WEBHOOK_SECRET`/`ZENDESK_WEBHOOK_SECRET`/`SLACK_SIGNING_SECRET`/`INTERCOM_*` artık kod tarafından **okunmuyor** (fallback'ler kapatıldı); `JIRA_WEBHOOK_SECRET` register route için KALIR. Dead env'ler kasıtlı silinmedi (geri alması pahalı, faydası kozmetik).
- **Ürün doğrulaması (saha işi — kod değil):** `docs/FEEDL-ROADMAP.md` milestone çıkış kriterleri (M0–M6) 2026-09-12'de tek tek gözden geçirildi. **8 madde ürün tarafında karşılandığı için `[x]` işaretlendi** (tez + hipotez metni, activation funnel, skor açıklanabilirliği, feature↔müşteri ve feature↔gelir ilişkisi, shipped state/tarih, **outcome kaydı**); **19 madde bilinçli olarak açık** bırakıldı (görüşmeler, ödeyen müşteri sayısı, kullanıcı testleri) — bunlar kodla "tamamlandı" yapılamaz.
  - Denetimde bulunan **tek ürün eksiği kapatıldı:** yayına giren bir fikrin gerçekleşen sonucu artık kaydedilebiliyor (özellik #12). Kalan M6 maddeleri ("en az 3 gerçek outcome tracking başlatıldı", "3 paying customer recurring workflow") hâlâ saha verisi bekliyor.
- **Acil olmayan (kapandı):** **#13** Sentry `LLM pipeline failure` özel kuralı — gerek yok, kapsam canlı kanıtlı (kural 807520 enabled, `lastTriggered` bugün). Sentry MCP'sinde kural **oluşturan** araç yok; `alerts:write` token'ı yalnız sende olabilir. Ek kural gerekirse `node tools/create-llm-alert.mjs --apply`.

## Lisans

Ticari SaaS — özel repo. (Bkz. `docs/plan.md` · `DESIGN.md` · `docs/standarts.md`.)
