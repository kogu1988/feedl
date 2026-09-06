# feedl — AI Destekli Müşteri Geri Bildirim Platformu

feedl, ürün ekiplerinin müşteri geri bildirimini toplaması, **AI ile analiz etmesi**,
önceliklendirmesi ve duyurması için tek bir platformdur. Canny'ye ücretsiz bir
alternatif — herkese açık bir topluluk portalı + gelir odaklı önceliklendirme.

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
  kaynak limitleri. (Paddle sandbox; canlı geçiş yakında.)

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
| Billing | Paddle (sandbox) |
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
- Resend: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` · Test: `ETHEREAL_EMAIL_USER`, `ETHEREAL_EMAIL_PASSWORD`
- Widget: `FEEDL_WIDGET_SECRET`, `FEEDL_WIDGET_ALLOWED_ORIGINS`
- Paddle: `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Sentry: `SENTRY_DSN` (opsiyonel; DSN yoksa no-op)
- Şifreleme: `ENCRYPTION_KEY` (entegrasyon secret AES-256-GCM; prod'da zorunlu)
- AI: `LLM_MODEL`, `LLM_FALLBACK_MODEL` (ücretsiz flaky olursa ücretli fallback)
- App: `NEXT_PUBLIC_APP_URL`

Gizli değerler yalnız `.env.local`'de — repo'ya yazılmaz.

## Doğrulama

```bash
npm run build   # tip + lint (in-session tek doğrulama)
npm test        # Vitest birim testleri
npm run test:e2e  # Playwright + axe erişilebilirlik (çalışan sunucu gerekir)
```

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

## Lisans

Ticari SaaS — özel repo. (Bkz. `docs/plan.md` · `DESIGN.md` · `docs/standarts.md`.)
