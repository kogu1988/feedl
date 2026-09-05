# feedl - AI Destekli Müşteri Geri Bildirim Platformu

**Domain:** feedl.app  
**Solo Founder:** (Sen)

---

## 1. Teknoloji Stack'i (Tamamen Free Tier & Serverless)

| Katman | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | React tabanlı, full-stack uygulama. |
| **Hosting** | Vercel (Hobby) | Serverless fonksiyonlar ve edge cache. |
| **Auth** | Clerk | Kullanıcı girişi, kaydı, admin/üye rolleri (en hızlı çözüm). |
| **Database** | Neon (PostgreSQL + pgvector) | Serverless Postgres, 5 GB free, pgvector desteği var. |
| **ORM** | Drizzle ORM | Tip güvenli veritabanı işlemleri, migration yönetimi. |
| **UI** | Shadcn/ui + Tailwind CSS | Kopyala-yapıştır component mimarisi. |
| **Background Jobs** | Inngest | Vercel timeout'ını aşan AI işlemleri için (free tier 50k adım). |
| **AI (LLM)** | OpenRouter API | Chat completion için tek API key; seçili model: `minimax/minimax-m3:free` (canlı test edildi: Türkçe + JSON uyumu iyi). |
| **AI (Embedding)** | OpenRouter API | Aynı key ile `/api/v1/embeddings`; model: `nvidia/nemotron-3-embed-1b:free` (2048 boyut, 33K context). |
| **Email** | Resend (Production) / Ethereal.email (Test) | "Özellik yayında" bildirimleri. Production'da Resend, geliştirme/testte Ethereal.email kullanılır. |

---

## 2. Ortam Değişkenleri (`.env.local`)

Proje çalışmadan önce aşağıdakileri `.env.local` dosyasına ekle:

```env
### Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

### Database (Neon)
DATABASE_URL=postgresql://[user]:[password]@[host].neon.tech/neondb?sslmode=require

### AI (OpenRouter - LLM)
OPENROUTER_API_KEY=
### Önerilen LLM Modeli: google/gemini-2.5-flash

### AI (OpenRouter - Embedding)
### Aynı key kullanılır: OPENROUTER_API_KEY
### Önerilen Embedding Modeli: nvidia/nemotron-3-embed-1b:free (2048 boyut)

### Background Jobs (Inngest)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

### Email (Resend) - Domain feedl.app doğrulanmalı
RESEND_API_KEY=

### Email Test (Ethereal.email) - Geliştirme ortamı
ETHEREAL_EMAIL_USER=
ETHEREAL_EMAIL_PASSWORD=
```

---

## 3. Veritabanı Şeması (Drizzle - Core Tables)

AI ajanı bu şemayı `/lib/db/schema.ts` olarak oluşturmalıdır.

```typescript
// users: Clerk ile senkronize edilecek.
// id: text, email: text, name: text, role: 'admin' | 'customer'

// posts: Ana fikir tablosu
// id: uuid, userId: text (FK), title: text, description: text,
// status: 'open' | 'planned' | 'in-progress' | 'shipped',
// sentiment_label: 'pozitif' | 'notr' | 'negatif', // prompts.md'deki LLM çıktısı
// ai_keywords: text[], // LLM'den dönen etiketler (örn: ['dark mode', 'api'])
// ai_summary: text,
// embedding_vector: vector(2048) // nemotron-3-embed-1b:free için (HNSW limit 2000; MVP'de index yok, halfvec ileride)
// duplicate_of: uuid (FK -> posts.id, nullable), // Duplicate tespiti durumunda orijinal post
// duplicate_note: text (nullable), // Duplicate açıklaması (örn: "#123 ile yüksek benzerlik")
// created_at: timestamp default now(),
// updated_at: timestamp

// votes: Oy tablosu (Kullanıcı başına 1 oy)
// id: uuid, userId: text (FK), postId: uuid (FK),
// created_at: timestamp default now()

// comments: Yorumlar (MVP sonrası - şimdilik planlanmıyor)
// id: uuid, userId: text (FK), postId: uuid (FK), content: text,
// created_at: timestamp default now()
```

---

## 4. Klasör Yapısı (Önerilen)

```text
/app
  /api
    /posts        (GET, POST)
    /votes        (POST, DELETE)
    /admin        (PATCH status, Sprint 7: /admin/export CSV)
    /webhooks     (Clerk webhook'ları)
    /inngest      (Inngest serve endpoint)
  /dashboard      (Admin paneli sayfaları)
  /portal         (Halka açık fikir portalı)
/lib
  /db             (Drizzle bağlantıları ve şemalar)
  /ai             (OpenRouter yardımcı fonksiyonları - LLM + embedding)
  /email          (Resend / Ethereal e-posta şablonları)
/components
  /ui             (Shadcn komponentleri)
  /custom         (Projeye özel komponentler)
/inngest          (Inngest fonksiyon tanımları)
/migrations       (Drizzle migration dosyaları)
```
