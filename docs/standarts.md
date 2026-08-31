# feedl - Güvenlik, Optimizasyon & Kodlama Standartları (v1.0)

Bu belge, projenin temel yapı taşlarıdır. AI ajanı ve geliştirici olarak **HER ZAMAN** bu kurallara uymak zorundasınız. İhlal edilen her kural, teknik borç olarak geri dönecektir.

---

## 1. 🔒 Güvenlik Standartları (Security)

### 1.1. Kimlik Doğrulama (Auth) & Yetkilendirme

- **Middleware Zorunluluğu:** Tüm route'lar Clerk middleware ile korunmalıdır. Public route'lar (ör. `/sign-in`, `/portal` sayfa görünümü, `GET /api/posts`, `/api/webhooks/*`) açıkça `matcher` ile beyaz listeye alınmalıdır. Fikir gönderme, oy verme ve admin işlemleri her zaman korumalıdır.
- **Admin Koruması:** `/dashboard/*` altındaki tüm sayfalar ve API route'ları (`/api/admin/*`) kesinlikle `auth().userId` ve DB'deki `users.role === 'admin'` kontrolünden geçmelidir. Rolün tek kaynağı Neon `users` tablosudur.
- **Webhook Güvenliği:** Clerk webhook'larında ve kullanılan diğer inbound webhook'larda (ör. Resend delivery events) imza (signature) doğrulaması yapılmalıdır.

### 1.2. Veritabanı (SQL Injection & Yetkilendirme)

- **Raw SQL Yasaktır:** Asla string birleştirme ile sorgu yazma. Tüm sorgular **Drizzle ORM** üzerinden yapılmalıdır.
- **Uygulama Seviyesinde RLS:** Neon'daki tablolar için uygulama seviyesinde kontrol yapın (Drizzle sorgularında `where` koşullarına `userId` ekleyin). Kullanıcılar sadece kendi oylarını görebilmeli/düzenleyebilmeli.
- **Gizli Veri Loglaması:** Asla `password`, `token` veya `email`'i terminale (`console.log`) veya dosyaya yazma. Production'da hassas veri içeren `console.log`'lar kaldırılmalı veya güvenli bir logger kullanılmalıdır.

### 1.3. Çevresel Değişkenler (Env)

- Tüm hassas bilgiler (API Key'ler, DB URL) `.env.local`'da tutulur. Kod içine hard-coded yazılmaz.
- `.env.local` kesinlikle `.gitignore`'a eklenmelidir.

---

## 2. ⚡ Optimizasyon & Performans (Performance)

### 2.1. Next.js & Frontend

- **Server Component Önceliği:** Mümkün olan her yerde `use client` kullanmaktan kaçının. Sadece interaktif UI (buton, form, dialog) için `use client` kullanın.
- **Dynamic Imports:** Modal, Dialog veya ağır grafik bileşenlerini `next/dynamic` ile lazy-load yapın.
- **Image Optimizasyonu:** Tüm görseller `next/image` komponenti ile kullanılmalıdır.

### 2.2. Veritabanı (DB Query Optimizasyonu)

- **Sadece İhtiyacın Olanı Getir:** `SELECT *` yerine `select({ id: posts.id, title: posts.title })` kullanın.
- **İndeksleme (Indexes):** `votes` tablosunda `(userId, postId)` ikili alanına **Unique Index** koyun. `posts` tablosunda `status` ve `created_at` alanlarına indeks ekleyin.
- **N+1 Sorgudan Kaçının:** Drizzle `leftJoin` veya `with` (CTE) kullanın.

### 2.3. AI & Background Jobs (Inngest)

- **Timeout Yönetimi:** AI çağrıları (OpenRouter) mutlaka **Inngest** arka plan işi olarak çalıştırılmalıdır. API route'larında doğrudan AI çağrısı yapmayın.
- **Retry Mekanizması:** Inngest'in otomatik `retry` mekanizmasına güvenin (en fazla 3 kez dene).
- **LLM Çıktı Doğrulaması:** Tüm LLM yanıtları Zod şeması ile doğrulanmalı ve normalize edilmelidir (ör. `nötr` → `notr`). Parse edilemeyen yanıt hata sayılmalı ve Inngest retry ile tekrar denenmelidir.

---

## 3. 🧹 Kodlama Stili & İsimlendirme (Coding Style)

### 3.1. TypeScript Sıkılığı (Strict Mode)

- `tsconfig.json` içinde `"strict": true` açık olmalıdır.
- `any` tipi **kesinlikle yasaktır**. Bilinmeyen tipler için `unknown` kullanın.
- Tüm fonksiyonların parametreleri ve return tipleri açıkça belirtilmelidir.

### 3.2. Dosya ve Klasör Yapısı (Convention)

- **Route Dosyaları:** `app/api/posts/route.ts` şeklinde. HTTP method'ları ayrı ayrı export edilir.
- **Bileşenler:** PascalCase (Örn: `PostCard.tsx`).
- **Yardımcı Fonksiyonlar (Lib):** camelCase (Örn: `formatDate.ts`).
- **Veritabanı Şemaları:** Tablo isimleri çoğul, sütun isimleri `snake_case`.

### 3.3. React/Next.js Best Practices

- **State Yönetimi:** Karmaşık durumlar için Zustand veya React Query kullanın.
- **Formlar:** React Hook Form + Zod kullanılır (shadcn `form` wrapper'ı registry'den kaldırıldı; formlar `input`/`textarea`/`button` bileşenleriyle elle kurulur). Validasyonlar Zod şeması ile yapılmalıdır.

---

## 4. 🧪 Hata Yönetimi (Error Handling)

### 4.1. API Route'ları (Standard Response)

Tüm API route'ları aşağıdaki standart JSON yapısını döndürmelidir:

**Başarılı (200/201):**

```json
{ "success": true, "data": { } }
```

**Başarısız (400/401/403/500):**

```json
{ "success": false, "error": "Kullanıcı dostu hata mesajı" }
```

> Kesinlikle stack trace veya hassas DB bilgisi döndürme!

### 4.2. Try-Catch Zorunluluğu

Tüm async fonksiyonlar (özellikle API route'ları ve Inngest fonksiyonları) mutlaka `try-catch` ile sarılmalıdır.

---

## 5. 🗄️ Git & Commit Standartları

- **Commit Mesajları:** Net ve İngilizce olmalıdır. (Örn: `feat: add vote toggle functionality`, `fix: resolve clerk webhook sync issue`)
- **Branch Stratejisi:** `main` korumalıdır. Her özellik için `feature/...` branch'leri açılır.

---

## 6. 🚀 Deployment & Build Kontrolü

- `next build` çalıştığında TypeScript hataları (`tsc`) ve ESLint uyarıları build'i patlatmalıdır.
- Vercel'de deploy öncesi tüm env değişkenlerinin eklendiğinden emin ol.
