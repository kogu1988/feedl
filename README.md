# feedl — AI Destekli Müşteri Geri Bildirim Platformu

feedl, ürün ekiplerinin müşteri geri bildirimini toplaması, AI ile analiz etmesi,
önceliklendirmesi ve duyurması için tek bir platformdur. Canny'ye ücretsiz bir
alternatif — herkese açık bir topluluk portalı + gelir odaklı önceliklendirme.

**Canlı:** [https://feedl.app](https://feedl.app)

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

## Teknoloji Stack'i

| Katman | Teknoloji |
| :--- | :--- |
| Framework | Next.js 15 (App Router, Turbopack) + React 19 |
| Hosting | Vercel (Hobby) |
| Auth | Clerk (multi-tenant workspace + rol kademesi) |
| DB | Neon PostgreSQL + pgvector (Drizzle ORM) |
| UI | Tailwind v4 + shadcn/ui + Base UI |
| Background | Inngest |
| AI | OpenRouter (`minimax-minimax3:free` LLM, `nemotron-3-embed-1b:free` embedding) |
| Email | Resend |
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
- Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- Resend: `RESEND_API_KEY` · Test: `ETHEREAL_EMAIL_USER`, `ETHEREAL_EMAIL_PASSWORD`
- Widget: `FEEDL_WIDGET_SECRET`, `FEEDL_WIDGET_ALLOWED_ORIGINS`
- Paddle: `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- App: `NEXT_PUBLIC_APP_URL`

Gizli değerler yalnız `.env.local`'de — repo'ya yazılmaz.

## Doğrulama

```bash
npm run build   # tip + lint (in-session tek doğrulama)
npm test        # Vitest birim testleri
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
```

## Lisans

Ticari SaaS — özel repo. (Bkz. `docs/plan.md` ve `product.md`.)
