# feedl — Proje Genel Durum Analizi

> **Perspektif:** Product Manager + Full-Stack Developer
> **Tarih:** 2026-09-13 · **Repo:** `github.com/kogu1988/feedl` · 551 commit · HEAD `ebcdc57`
> **Kaynaklar:** `README.md`, `DESIGN.md`, `docs/{plan.md, FEEDL-ROADMAP.md, standarts.md,
> free-pro_plans.md, frontend_plan.md, codereview.md, brand-voice-guidelines.md}`,
> `.agents/skills/feedl/SKILL.md`, `packages/feedl-widget/README.md`,
> `tools/llm-model-test-prompts.md` + kod tabanı ölçümleri + canlı prod/DB/GitHub kontrolleri.

---

## 1. Yönetici Özeti

feedl, tek kişi tarafından production kalitesinde kodlanmış, çalışan bir AI destekli
müşteri geri bildirim SaaS'ıdır. **Mühendislik tarafı bitmiştir; ürün tarafı hiç
başlamamıştır.**

Projenin kendi operating planı (`docs/FEEDL-ROADMAP.md`) tek bir kural üzerine kurulu:
**"Önce kanıt, sonra kod."** Bugünkü durum bu kuralın tam tersidir — 54.000 satır kod,
76 API ucu, 36 tablo yazılmış; buna karşılık **0 gerçek kullanıcı, 0 geri bildirim,
0 müşteri görüşmesi** var. Milestone listesinde **8 madde kapalı, 59 madde açık** ve
açık maddelerin neredeyse tamamı kodla değil sahada kapanacak işler.

En kritik tespit şudur: ürünün farklılaşma tezi **"gelir bağlamıyla önceliklendirme"**
(revenue-aware prioritization). Bu tezin çalışması için `companies` + `opportunities` +
MRR verisi gerekir. Canlı veritabanında **`companies` tablosu boş (0 satır)**. Yani
ürünün satış vaadini oluşturan çekirdek mekanizma **bir kez bile gerçek veriyle
çalıştırılmamıştır.**

| Boyut | Skor | Gerekçe |
|---|:--:|---|
| Kod kalitesi & mimari | **8.5**/10 | 0 `any`, 0 TODO, tek-kaynak disiplini, "neden" yorumları; 4-5 dosya refactor adayı |
| Güvenlik | **9**/10 | 25 maddelik borç listesindeki tüm kritik/orta sızıntılar kapatılmış ve testle kilitlenmiş |
| Test & doğrulama | **8**/10 | 336 birim + 32 e2e + a11y yeşil; auth e2e atlanıyor, DB-backed test zayıf, yük testi yok |
| Performans | **7.5**/10 | TTFB 0.6–1.3 s (Hobby cold start baskın); `staleTimes` + SQL-içi sıralama doğru |
| Gözlemlenebilirlik | **8**/10 | Sentry runtime capture canlı kanıtlı; uptime monitörü bilinçli kapalı |
| Dokümantasyon | **8.5**/10 | Eşine az rastlanır gerekçe kültürü; 3 noktada tazelik kayması (§7) |
| **Pazar doğrulaması** | **1**/10 | 0 müşteri, 0 görüşme, 0 organik kullanım |
| **Ölçüm / analytics** | **2**/10 | Activation funnel tanımlı ama **hiçbir adımı ölçülmüyor** |
| **Pazara hazırlık (dil/pazar uyumu)** | **3**/10 | UI %100 Türkçe + `<html lang="tr">` sabit, fiyat USD, hedef küresel SaaS |
| **Dogfooding** | **2**/10 | Kendi portalında 0 fikir; ürün kendi ürününü kullanmıyor |

**Tek cümlelik hüküm:** *Satılabilir bir ürün var; satılabilirliğini gösteren tek bir
kanıt yok. Sıradaki iş kod yazmak değil, ilk 10 kullanıcıyı bulmak ve funnel'ı ölçmeye
başlamaktır.*

---

## 2. Nicel Anlık Görüntü

### 2.1 Kod tabanı

| Metrik | Değer |
|---|---|
| TS/TSX dosyası (`app`+`lib`+`components`+`inngest`) | 301 |
| Toplam LOC (kod+test+e2e+tools+packages) | **54.008** |
| API route (`route.ts`) | 76 |
| Migration | 62 (son uygulanan: `0061`) |
| Özel bileşen (`components/custom`) | 85 |
| Dashboard sayfası | 13 |
| `any` kullanımı | **0** |
| `TODO` / `FIXME` / `HACK` | **0** |
| `console.log` | 2 |
| Birim test | **336** (49 dosya) |
| E2E | **32 passed / 3 skipped** (a11y dahil, tamamen yeşil) |

### 2.2 En büyük dosyalar (refactor radarı)

| Dosya | LOC | Değerlendirme |
|---|--:|---|
| `lib/db/schema.ts` | 1321 | Kabul edilebilir — 36 tablo tek şema dosyasında, Drizzle normu |
| `inngest/functions.ts` | 1256 | ⚠️ **Bölünmeli** — autopilot/notify/digest/webhook tek dosyada |
| `app/(main)/dashboard/page.tsx` | 1246 | ⚠️ **Bölünmeli** — sayfa + veri yükleme + görünüm iç içe |
| `components/custom/companies-manager.tsx` | 1100 | ⚠️ **Bölünmeli** — CRUD + import + MRR formu tek bileşen |
| `app/(main)/portal/[id]/page.tsx` | 833 | Sınırda; izlenmeli |

### 2.3 Canlı üretim durumu (Neon, ölçüldü)

| Tablo | Satır |
|---|--:|
| `workspaces` | 2 (`feedl`=pro, `deneme`=free) |
| `users` | **1** |
| `boards` | 2 |
| `posts` | **0** |
| `votes` | **0** |
| `comments` | **0** |
| `companies` | **0** ← tezin veri tabanı boş |
| `subscriptions` | 2 |
| `workspace_members` | 2 |

`/api/health` → `{"status":"ok","db":"ok"}` · `/api/posts` → `{"success":true,"data":[]}`

### 2.4 Süreç sağlığı

| Metrik | Değer |
|---|---|
| Dependabot güvenlik uyarısı | **0** ✅ |
| Açık Dependabot PR | **5** (2'si CI'da kırmızı) |
| Son CI koşusu (`main`) | ✅ yeşil |
| Sentry unresolved (7 gün) | 0 |
| npm `@feedl/widget` | **yayında** (`0.1.0`) ✅ |
| Milestone ilerlemesi | **8 kapalı / 59 açık** |

---

## 3. Ürün Analizi (PM bakışı)

### 3.1 Konumlandırma: doğru ama kanıtsız

Tez net ve savunulabilir:

> *"Müşteri isteklerini tahminle değil, veriyle önceliklendir."*
> Kategori: Customer Feedback Management → Wedge: **Revenue-aware Product Prioritization**

Bu, kalabalık bir pazarda (feedback board araçları) gerçek bir farklılaşma eksenidir:
rakipler "en çok oy alan" gösterirken feedl "en çok para getiren"i gösterme iddiasında.
`docs/FEEDL-ROADMAP.md` bunun bir **hipotez** olduğunu dürüstçe yazıyor — bu olgun bir
tavır. Ancak hipotez 2 haftadır test edilmedi; yerine daha fazla kod yazıldı.

### 3.2 🔴 Kritik çelişki: Tezin veri girişi bir aktivasyon duvarı

Gelir skoru = `oy + müşteri sayısı + fırsat değeri (MRR)`. Bu skorun anlamlı olması için
kullanıcının şunları yapması gerekir:

```
Kaydol → Workspace → Board → Feedback topla → Şirket kaydı aç → MRR gir
      → Fırsat gir → Feedback'i şirkete bağla → ANCAK ŞİMDİ skor anlamlı
```

Bu **8 adımlık bir aktivasyon zinciri** ve 5.–8. adımlar tamamen manuel veri girişi.
Roadmap'in kendi Activation tanımı da bunu kabul ediyor (feedback + customer/revenue
ilişkisi + prioritization kararı). Sorun şu:

- **CRM/Stripe entegrasyonu bilinçli olarak yapılmadı** (P2, "DO NOT BUILD" listesinde).
- Dolayısıyla veri girişi tek yol: **elle** ya da CSV import (ki **CSV import hiç gerçek
  veriyle test edilmedi**).
- Yani ürünün en güçlü iddiası, en yüksek sürtünmeli akışın arkasında duruyor.

**Sonuç:** Kullanıcı Free planda "bedava Canny benzeri board" değerini 2 dakikada alır;
asıl farklılaşma olan gelir skorunu görmek için ise yarım saatlik manuel veri girişi
gerekir. Bu, Pro dönüşümünün önündeki **1 numaralı yapısal engeldir** ve ölçülmediği
için görülmüyor.

### 3.3 🔴 Funnel tanımlı ama hiç ölçülmüyor

`docs/FEEDL-ROADMAP.md` §4'te 13 adımlı bir funnel var
(`Visitor → Signup → Workspace → Feedback → Customer Linked → Revenue Context →
Priority Viewed → Product Decision → Weekly Return → Paid → Expansion → Referral`).

Kod tarafındaki gerçek: `components/custom/google-analytics.tsx` yalnızca
`gtag('config', ...)` ile **page_view** gönderiyor. Özel olay (`event`) çağrısı
**kodun hiçbir yerinde yok.**

| Funnel adımı | Ölçülüyor mu? |
|---|---|
| Visitor | ⚠️ Yalnız sayfa görüntüleme (GA/Vercel) |
| Signup | ❌ |
| Workspace Created | ❌ |
| Feedback Added | ❌ |
| Customer Linked | ❌ |
| Revenue Context Added | ❌ |
| Priority Viewed | ❌ |
| Product Decision | ❌ |
| Weekly Return | ❌ |
| Paid | ⚠️ Yalnız Paddle webhook (analytics'e bağlı değil) |

**Etki:** İlk kullanıcılar geldiğinde nerede düştükleri bilinemeyecek. Bu, tek başına
"3 ay boyunca neden kimse Pro'ya geçmedi?" sorusunu cevapsız bırakır. En ucuz, en yüksek
getirili iş budur (yarım gün).

### 3.4 🟡 Free/Pro ayrımı sağlam, konumlandırma dili düzeltilmiş

`docs/free-pro_plans.md` denetimi sonrası yapılan revizyon isabetli:

- **Free:** 1 workspace · 1 board · 1 üye · 50 takipçi · "Powered by feedl"
- **Pro ($19/ay, $180/yıl):** Sınırsız workspace/board · 10 üye · özel domain ·
  marka kaldırma · AI Insights · entegrasyonlar · API/webhook · **gelir skoru** ·
  özel board · sonuç kaydı (outcome)

Ayrım stratejik olarak doğru: *Free geri bildirimi toplar, Pro hangi geri bildirimin
önemli olduğunu gösterir.* Free plan yapay olarak sakat bırakılmamış — bu iyi freemium.

Küçük bir tutarsızlık kaldı: **hesap düzeyi Pro devralma** kuralı (owner'ın bir
workspace'i Pro ise diğerleri de Pro) doğru bir karardı, ancak bu kural pricing
sayfasında **hiç anlatılmıyor**. "Sınırsız workspace" satırı bunu ima ediyor ama bir
kullanıcı ikinci workspace'inde Pro özelliklerini görünce bunun neden böyle olduğunu
bilmiyor. Tek cümlelik bir açıklama yeterli.

### 3.5 🔴 Dogfooding yapılmıyor

Kullanıcı daha önce açıkça şunu söylemişti: *"biz de kendi sitemizde kullanıcı geri
bildirimlerini takip edelim, böylece projemizi de test etmiş oluruz canlı canlı."*

Gerçek durum: `feedl.app/portal` → **0 fikir**. Widget kuruldu, self-embed politikası
yazıldı, görsel geri bildirim eklendi — ama içeri tek bir kayıt girmedi. Bunun üç
maliyeti var:

1. **Ürün boş görünüyor.** Değerlendirme için gelen bir ziyaretçi boş bir portal görür;
   bu, satın alma niyetini doğrudan kırar (sosyal kanıt yok).
2. **Çok-kiracılı içerik izolasyonu hâlâ kanıtsız.** README bunu açıkça kabul ediyor:
   host düzeyi kanıtlandı, **içerik düzeyi kanıt yok** çünkü iki workspace de boş.
3. **Kendi AI hattın gerçek veriyle hiç çalışmadı.** Autopilot, benzerlik tespiti,
   korpus içgörüleri, haftalık digest — hepsi sentetik/smoke testlerle doğrulandı.

### 3.6 🟡 Dil / pazar uyumsuzluğu

- UI **%100 Türkçe**, `app/layout.tsx` içinde `<html lang="tr">` **sabit kodlanmış**.
- i18n altyapısı **yok** (`[locale]` segmenti yok, çeviri katmanı yok).
- Fiyatlandırma **USD** ($19/$180), ödeme Paddle (Merchant of Record, küresel).
- SEO sayfaları (`/alternative`, `/how-to-collect-feedback`) Türkçe yazılmış.

Bu, bilinçli bir "önce Türkiye pazarı" kararıysa tutarlıdır — ama o zaman fiyatın TRY
gösterimi ve yerel konumlandırma gerekir. Küresel SaaS hedefleniyorsa İngilizce kritik
yoldadır. **Şu an ikisinin arasında duruyor ve bu bir karar borcudur.** Karar
verilmeden İngilizce'ye yatırım yapmak erken olur; önce hedef pazar netleşmeli.

### 3.7 🟢 Ürün olgunluğu: beklenenin çok üstünde

Adil olmak gerekirse, 12 temel özelliğin hepsi çalışır durumda ve birçoğu rakip
seviyesinin üstünde:

- **Görsel geri bildirim + teknik bağlam** (pin, screenshot, viewport/OS/tarayıcı,
  private Blob) — bu, çoğu ücretli rakipte ayrı bir ürün.
- **AI triage öğrenmesi** (admin "ilgisiz" derse workspace-scoped sinyal) — akıllı.
- **Sonuç kaydı (outcome)** — "ne yaptık" değil "işe yaradı mı" sorusu; nadir.
- **Haftalık AI digest** — retention mekanizması olarak doğru kurgu.
- **Özel alan adı** self-servis (Vercel API + TXT doğrulama + apex + Cloudflare uyarısı).

---

## 4. Teknik Analiz (Full-Stack bakışı)

### 4.1 🟢 Mimari: doğru ölçekte, doğru takaslarla

```
Public UI · Dashboard · Widget(iframe)
              │
     Next.js 15 App Router (RSC + API)
   ┌──────────┼───────────┐
 Clerk    Neon+pgvector  Paddle
              │
        Inngest workers
       ┌──────┼──────┐
  OpenRouter      Resend
  Upstash · Vercel · Sentry
```

Monolit tercihi **doğru** ve README'de gerekçesiyle yazılı ("AI/worker ağırlaşınca
böl"). Erken mikroservis kaçınılmış — solo founder için isabetli.

**Öne çıkan mimari kararlar:**

| Karar | Değerlendirme |
|---|---|
| Kimlik Clerk, tenant verisi Neon (Clerk Org senkronu **yok**) | ✅ Tek kaynak net; doğru |
| `getWorkspaceId` önceliği: widget > çerez > host | ✅ Testle kilitli; çerez yetki barı DEĞİL, routing ipucu |
| Fail-closed host politikası (bilinmeyen alt alan → 404) | ✅ Güvenlik açısından doğru; robots/sitemap da kapanıyor |
| Fail-closed middleware allowlist (`createRouteMatcher` yerine) | ✅ Deprecated API'den kaçış + önek sızması testi |
| AI çağrıları yalnız Inngest'te | ✅ `standarts.md` kuralı; timeout/retry doğru yerde |
| Hesap düzeyi Pro (`resolveAccountPlanKey`) | ✅ Free'de tek ek sorgu; Pro'da sıfır |
| SQL-içi gelir sıralaması (`revenueScoreOrderSql`) | ✅ Tüm listeyi JS'e çekmiyor; sayfalama bozulmuyor |

### 4.2 🟢 Kod kalitesi: olağandışı disiplinli

- **`any` = 0**, **TODO = 0** — bu ölçekte bir kod tabanı için çok nadir.
- Yorum kültürü "ne yaptığını" değil **"neden böyle yaptığını"** anlatıyor; sprint
  numaraları ve tarihlerle iz sürülebilir. Bu, solo projede en değerli varlıktır
  (6 ay sonraki kendine bırakılan not).
- Tek-kaynak disiplini tutarlı: `plan-config.ts`, `plan-copy.ts`, `lib/widget/embed.ts`,
  `lib/dns-records.ts`, `public-paths.ts` — kural iki yere kopyalanmamış.
- `"use client"` modülünden düz veri import eden server component tuzağı **belgelenmiş**
  ve mimariyle çözülmüş (`plan-config` ↔ `plan-copy` ayrımı). Bu seviyede bir farkındalık
  beklenenin üstünde.

### 4.3 🟡 Refactor adayları (aciliyet düşük, borç gerçek)

| Dosya | Sorun | Öneri |
|---|---|---|
| `inngest/functions.ts` (1256) | Autopilot + notify + digest + webhook fanout tek dosyada | `inngest/functions/{autopilot,notify,digest,webhooks}.ts` |
| `app/(main)/dashboard/page.tsx` (1246) | Sayfa + veri yükleme + görünüm iç içe | Veri yükleyicileri `lib/dashboard/*` altına al |
| `components/custom/companies-manager.tsx` (1100) | CRUD + import + MRR formu tek bileşen | Liste / form / import olarak üçe böl |

Hiçbiri bugün acı vermiyor (tek geliştirici, tam bağlam). Ama **ikinci geliştirici
gelirse veya 3 ay ara verilirse** bu dosyalar ilk yavaşlama noktası olur. Faz 3'e
bırakılması doğru karar.

### 4.4 🟢 Güvenlik: denetimden geçmiş ve kapatılmış

`docs/codereview.md`'deki 7 maddelik aksiyon listesinin **tamamı** kapatılmış:

| # | Bulgu | Durum |
|---|---|---|
| 1 | Linear webhook'ta **modül seviyesi** `workspaceIdOverride` → cross-tenant yazma | ✅ Fonksiyon-lokal + kırmızıya düşen regresyon testi |
| 2 | `webhookEndpoints.secret` düz metin | ✅ AES-256-GCM şifreli, geçiş uyumlu |
| 3 | Gelen webhook'larda rate limit yok | ✅ 300/dk/IP, imzadan **önce** |
| 4 | `ENCRYPTION_KEY` yoksa sessiz plaintext | ✅ Sentry `captureMessage` |
| 5 | Paddle handler SRP ihlali | ✅ Zod şema + ölü kod temizliği |
| 6 | Ölü `verifyPaddleSignature` | ✅ Silindi |
| 7 | Custom domain sahiplik doğrulaması | ✅ `_feedl.<domain>` TXT + unique index |

Ek olarak kapatılan yüksek etkili bulgular: **gelir bağlamı tenant sızıntısı** (#22 —
`companies.workspace_id` filtresi eksikti, A workspace'inin MRR'i B'nin skoruna
sızıyordu), legacy global webhook secret emekliliği (#10), `createRouteMatcher`
kaldırılması (#21).

**Pozitif not:** `lib/widget/jwt.ts` elle yazılmış bir HS256 doğrulayıcı olmasına rağmen
`timingSafeEqual`, zorunlu `exp`, katı base64url ve `sub` whitelist regex'i içeriyor —
elle yazılmış auth kodu için gerçekten sağlam.

**Açık kalan tek düşük riskli madde:** dead env secret'ları
(`LINEAR_WEBHOOK_SECRET`, `ZENDESK_WEBHOOK_SECRET`, `SLACK_SIGNING_SECRET`,
`INTERCOM_*`) artık kod tarafından okunmuyor ama Vercel'de duruyor. Bilinçli karar,
kozmetik.

### 4.5 🟡 Test: iyi ama dar

| Katman | Durum | Boşluk |
|---|---|---|
| Birim (336) | ✅ Güçlü — saf mantık, izolasyon, plan türetme, host politikası | — |
| E2E smoke (32) | ✅ Ana yüzeyler + API kapıları + a11y | — |
| E2E auth (3) | ⚠️ **Atlanıyor** — Clerk test env yok | Gerçek giriş akışı hiç koşmuyor |
| DB-backed | ⚠️ Zayıf | Çoğu test mock'lu; gerçek şema regresyonu yakalanmaz |
| Yük / performans | ❌ Yok | Bilinmeyen: 100 eşzamanlı oy, 10k post'lu portal |
| Görsel regresyon | ❌ Yok | DESIGN.md token'ları elle korunuyor |

**En değerli eksik:** DB-backed entegrasyon testleri. 62 migration ve 36 tablo var;
bir migration hatası bugün yalnız canlıda fark edilir.

### 4.6 🟡 Performans

- **TTFB:** `/` 0.64–1.30 s · `/portal` 0.84–1.03 s · `/api/health` 0.49–1.70 s.
  Yapısal regresyon yok; **Vercel Hobby cold start** baskın.
- `experimental.staleTimes = { dynamic: 30, static: 300 }` — sekme değiştirmede
  gereksiz Neon sorgusu kesildi. Free tier koruması açısından doğru hamle.
- Gelir sıralaması ve "en yüksek etki" listesi **SQL'de** — N+1 yok, tüm liste JS'e
  çekilmiyor.
- **Bilinmeyen:** 10.000 post'lu bir portalın davranışı. pgvector benzerlik sorgusu
  hiç yük altında ölçülmedi.

### 4.7 🟢 Gözlemlenebilirlik

Sentry `onRequestError` + `global-error` kurulu ve **uçtan uca canlı kanıtlı**
(`tools/prove-ai-alert.mjs` → `FEEDL-4` issue → yüksek öncelik kuralı → e-posta alındı).
AI hattı `area=llm` etiketiyle raporlanıyor. Bu, "hata var ama kimse görmüyor" sınıfını
kapatıyor.

Uptime monitörü kullanıcı kararıyla kapalı — `/api/health` hazır durumda bekliyor.
Kabul edilebilir (tek müşteri yok, SLA taahhüdü yok).

### 4.8 🔴 Bakım: Dependabot PR'ları birikmiş

5 açık PR var, 2'si CI'da kırmızı:

| PR | Paket | Durum | Değerlendirme |
|---|---|---|---|
| #7 | `vite` 6.4.3 → **8.3.0** | ✅ yeşil | Major; yalnız test aracı — merge edilebilir |
| #6 | `eslint-config-next` 15.5.24 → **16.3.4** | ❌ kırmızı | **Next 16'ya bağlı** — Next 15.5'te merge EDİLMEMELİ, kapat |
| #5 | `react` + `@types/react` | ❌ kırmızı | React **tam sabitlenmiş** (19.2.8, `SKILL.md` kuralı) — kapat |
| #4 | `@clerk/testing` 2.2.33 → 2.2.34 | ✅ yeşil | Patch — merge |
| #3 | `@eslint/eslintrc` 3.3.6 → 3.3.7 | ✅ yeşil | Patch — merge |

**Güvenlik uyarısı 0** — asıl risk yok. Ama iki PR kalıcı olarak kırmızı kalacak ve
CI geçmişini kirletiyor; kapatılıp Dependabot `ignore` kuralı yazılmalı.

---

## 5. Süreç ve Operasyon

### 5.1 🟢 Güçlü yanlar

- **Migration disiplini:** `drizzle-kit push` yasak (çünkü `.env.local` = production).
  Desen: `migrations/00NN_*.sql` + idempotent `tools/apply-00NN.mjs`. Bu, üretim
  veritabanını koruyan gerçek bir güvenlik önlemi.
- **Deploy bütçesi:** Vercel Hobby 100 deploy/24s limiti belgelenmiş; "commit biriktir,
  tek push" kuralı `standarts.md` §6'da yazılı ve uygulanıyor.
- **CI:** 2 job — `test-and-build` (DB'siz) + `e2e` (DB secret'lı). Build'in DB olmadan
  geçmesi şartı, statik üretimi DB'ye bağımlı hâle getiren bir sınıf hatayı önlüyor.
- **`tools/` klasörü:** 39 çalıştırılabilir doğrulama betiği. Bu, "iddia ediyorum" ile
  "ölçtüm" arasındaki farkı kuran altyapı.

### 5.2 🔴 Risk: bilgi tek kişide ve gitignored dosyalarda

`docs/` klasörü **gitignored** (commit `01a2974` ile takipten çıkarılmış). İçinde
projenin gerçek hafızası var:

| Dosya | Satır | İçerik |
|---|--:|---|
| `docs/plan.md` | 3065 | Sprint günlüğü — projenin tam tarihi |
| `docs/FEEDL-ROADMAP.md` | 1902 | Operating plan, milestone çıkış kriterleri |
| `docs/frontend_plan.md` | 1286 | Ürün revizyon planı (P0/P1/P2) |
| `docs/free-pro_plans.md` | 364 | Plan denetimi |
| `docs/standarts.md` | 138 | **Zorunlu** güvenlik/kodlama kuralları |

Bu **6.964 satır** yalnızca bu makinede duruyor. Disk arızası = projenin tüm kurumsal
hafızasının kaybı. Kod GitHub'da güvende; **kararların gerekçesi değil.**

> `SKILL.md` bu dosyaları "source of truth — read before acting" diye işaret ediyor.
> Yani yeni bir oturum/geliştirici, var olmayabilecek dosyalara yönlendiriliyor.

**Öneri:** Özel repo zaten (`kogu1988/feedl` private). Sır içermeyen planlama
dosyalarının gitignore'dan çıkarılması için teknik bir engel yok. Alternatif: ayrı bir
private `feedl-docs` reposu.

---

## 6. Risk Kaydı

| # | Risk | Olasılık | Etki | Skor | Azaltım |
|:--:|---|:--:|:--:|:--:|---|
| R1 | Tez yanlış çıkar — kimse gelir bağlamı girmez | **Yüksek** | **Kritik** | 🔴 | 10 görüşme; funnel ölçümü; CSV import'u kolaylaştır |
| R2 | Aktivasyon duvarı — 8 adımlı zincir tamamlanmaz | **Yüksek** | Yüksek | 🔴 | Funnel olayları + onboarding'de "örnek veri" modu |
| R3 | Kurumsal hafıza kaybı (`docs/` gitignored) | Orta | **Kritik** | 🔴 | Private repo'ya al veya ayrı docs reposu |
| R4 | Boş portal → değerlendiren ziyaretçi güven kaybı | **Yüksek** | Orta | 🟡 | Dogfood: kendi fikirlerini gir, ilk 10 kaydı oluştur |
| R5 | Dil/pazar kararsızlığı | Orta | Yüksek | 🟡 | Hedef pazarı **karara bağla**; sonra yatırım yap |
| R6 | Tek kişi bağımlılığı (bus factor = 1) | Orta | Yüksek | 🟡 | Runbook + docs'u versiyonla |
| R7 | Hobby tier sınırları (deploy/DB/fonksiyon) | Düşük | Orta | 🟢 | İlk ödeyen müşteride Pro'ya geç |
| R8 | Migration regresyonu (DB-backed test yok) | Orta | Orta | 🟡 | Neon branch üzerinde entegrasyon testi |
| R9 | pgvector/portal ölçek davranışı bilinmiyor | Düşük | Orta | 🟢 | 10k kayıtla yük provası |
| R10 | Yasal: marka adı artıkları | Düşük | Orta | 🟡 | `SKILL.md` + `docs/archive/canny.md` temizliği (§7) |

---

## 7. Dokümantasyon Tazelik Kayması (bulunanlar)

Üç yerde belge ile gerçek ayrışmış:

1. **`README.md` — Dependabot iddiası.** Metinde "0 açık Dependabot PR" geçiyor;
   gerçek **5 açık PR** (2'si kırmızı). Güvenlik uyarısı kısmı doğru (0).

2. **🔴 `.agents/skills/feedl/SKILL.md` — marka adı hâlâ duruyor.** Kullanıcı açıkça
   *"canny adı geçmesin, bu yasal soruna neden olabilir"* demişti ve kod/README
   temizlendi. Ancak `SKILL.md`:
   - Satır 3 (`description`): `"AI feedback platform (Canny clone)"`
   - Satır 9 (gövde): `"a Canny clone built solo"`
   - Satır 29: `docs/archive/canny.md` referansı
   Ayrıca `docs/archive/canny.md` dosyası diskte duruyor. Bu dosyalar gitignored/skill
   olduğu için public risk düşük ama **verilen karar yarım uygulanmış.**

3. **`SKILL.md` — eskimiş mimari notları.** Middleware bölümü hâlâ
   `createRouteMatcher` tabanlı public route listesinden bahsediyor; bu API
   **kaldırıldı** (`lib/auth/public-paths.ts`). Rol kademesi de eski adlandırmayı
   (`contributor`) taşıyor; güncel kademe **owner / manager / member**.

---

## 8. Öncelikli Aksiyon Planı

### P0 — Bu hafta (kod değil, kanıt)

| # | İş | Süre | Neden |
|:--:|---|:--:|---|
| 1 | **Funnel olaylarını ölç.** GA4 custom event: `signup`, `workspace_created`, `feedback_added`, `customer_linked`, `revenue_added`, `priority_viewed`, `upgrade_clicked` | 4 sa | Ölçmeden optimize edilemez; ilk kullanıcı gelmeden hazır olmalı |
| 2 | **Dogfood.** Kendi portalına 10-15 gerçek fikir gir (kendi backlog'undan), 2-3'üne şirket + MRR bağla | 2 sa | Boş portal satmaz; AI hattı gerçek veriyle ilk kez çalışır; **R4 + içerik izolasyon kanıtı** aynı anda kapanır |
| 3 | **`docs/` klasörünü versiyonla.** Private repo'ya al veya `feedl-docs` reposu aç | 30 dk | 6.964 satır kurumsal hafıza tek diskte — **R3** |
| 4 | **Dependabot temizliği.** #3, #4, #7 merge; #5, #6 kapat + `ignore` kuralı yaz | 1 sa | CI geçmişi temizlensin; React/Next sabitleri korunsun |
| 5 | **`SKILL.md` temizliği.** Marka adı kaldır, middleware/rol notlarını güncelle | 30 dk | Verilen karar yarım uygulanmış — **R10** |

### P1 — Önümüzdeki 2-3 hafta (ilk kanıt)

| # | İş | Süre | Neden |
|:--:|---|:--:|---|
| 6 | **10 müşteri görüşmesi** (M1 çıkış kriteri) | 2 hafta | Tezin tek gerçek testi; 59 açık milestone'un kilidi burada |
| 7 | **Aktivasyon sürtünmesini azalt:** onboarding'de "örnek veriyle dene" modu | 1 gün | **R2** — 8 adımlı zinciri 2 adıma indirir |
| 8 | **CSV müşteri import'unu gerçek veriyle test et** | 2 sa | Manual-first kuralının (Rule 2) gereği; CRM'den önce bu çalışmalı |
| 9 | **Hedef pazar kararı** (TR-first mi, EN-first mi) | — | **R5**; i18n yatırımı bu karardan sonra |
| 10 | **Pricing'e hesap düzeyi Pro açıklaması** ekle | 30 dk | §3.4 tutarsızlığı |

### P2 — Sonraki çeyrek (ölçek borcu)

| # | İş | Neden |
|:--:|---|---|
| 11 | `inngest/functions.ts` + `dashboard/page.tsx` + `companies-manager.tsx` bölünmesi | §4.3 — ikinci geliştirici/3 ay ara senaryosu |
| 12 | Neon branch üzerinde DB-backed entegrasyon testleri | **R8** — migration regresyonu |
| 13 | Yük provası (10k post, 100 eşzamanlı oy, pgvector) | **R9** |
| 14 | Custom domain'in gerçek domainle uçtan uca provası | Açık kalan tek özellik provası |
| 15 | Clerk test env → auth e2e'yi gerçekten koştur | §4.5 — 3 skip kapanır |

### Bilinçli olarak YAPILMAYACAKLAR (şimdilik)

- ❌ CRM/Stripe entegrasyonu — Rule 2 (manual first); önce CSV kanıtı
- ❌ Mikroservise bölme — Rule 6; darboğaz yok
- ❌ i18n altyapısı — §3.6 kararı verilmeden
- ❌ Yeni özellik — Rule 1: kanıt yoksa feature yok

---

## 9. 30 / 60 / 90 Gün

**30 gün — Ölç ve kanıt topla**
Funnel olayları canlı · Dogfood portal dolu · 10 görüşme tamam · docs versiyonlu ·
Dependabot temiz. **Çıkış:** M1 (Problem Evidence) kapanır.

**60 gün — İlk kullanıcılar**
Aktivasyon sürtünmesi azaltılmış · 5 gerçek kullanıcı ürünü kullanıyor · funnel'da ilk
düşüş noktaları görünür · fiyat itirazlarının deseni belirmeye başlar.
**Çıkış:** M3 (First Value).

**90 gün — İlk gelir**
3-5 ödeyen müşteri · en az 1 müşteri gelir bağlamını gerçekten kullanıyor · outcome
kaydı ilk kez gerçek veriyle doluyor. **Çıkış:** M5 (Paid PMF) yolunda.

---

## 10. Sonuç

**Mühendislik: 8.5/10.** Bu kod tabanı, çoğu seed aşaması startup'ın ürününden daha
temiz. Güvenlik denetimi yapılmış ve kapatılmış, tenant izolasyonu testle kilitlenmiş,
kararlar gerekçeleriyle yazılmış. Teknik borç bilinçli, listelenmiş ve önceliklendirilmiş
— gizlenmiş değil.

**Ürün: 2/10.** Hiçbir şey doğrulanmadı. Tez bir hipotez, funnel ölçülmüyor, portal boş,
görüşme yapılmadı, tek bir müşteri yok.

Projenin en büyük riski teknik değil. Risk şu: **mühendislik konfor alanı olduğu için
kod yazmaya devam etmek ve pazar kanıtını sonsuza kadar ertelemek.** Roadmap'in kendisi
bunu öngörmüş ve zaman dağılımını yazmış: *%30 müşteri/satış, %30 keşif, %20 mühendislik.*
Gerçek dağılım ise ~%95 mühendislik.

> **Bir sonraki commit'in kod olmaması gerekiyor.** Bir görüşme notu, bir funnel olayı,
> kendi portalına girilmiş ilk 10 fikir olmalı.

Ürün hazır. Şimdi müşteri bulma zamanı.

---

*Hazırlayan: Zed agent (PM + Full-Stack analizi) · 2026-09-13*
