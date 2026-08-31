# Geliştirme Planı (Sprint Log)

**Uygulayıcı:** Solo Vibecoder
**Strateji:** Bir sonraki sprinte geçmeden önce bir öncekinin test edildiğinden emin ol.

---

## Sprint 0: Proje Kurulumu & Temel Ayarlar (1. Gün)

**Hedef:** Proje iskeletini oluştur, UI'ı hazırla.

**Yapılacaklar:**

1. `npx create-next-app@15 . --typescript --tailwind --app` (sürümü 15 ile sabitle)
2. Shadcn/ui kurulumu: `npx shadcn@latest init` (default options).
3. Shadcn bileşenlerini ekle: `button`, `card`, `input`, `textarea`, `dropdown-menu`, `dialog`, `toast`. (Not: `form` bileşeni shadcn registry'sinden kaldırıldı.)
4. Form validasyonu için kur: `npm i react-hook-form zod @hookform/resolvers` (shadcn form wrapper'ı yok; RHF + Zod doğrudan kullanılır)
5. `next.config.js` dosyasını kontrol et (Next.js 15 ile `.ts`/`.mjs` de olabilir).
6. Drizzle ORM ve Neon bağlantısını kur: `npm i drizzle-orm @neondatabase/serverless`
7. Migration araçlarını kur: `npm i -D drizzle-kit`
8. `drizzle.config.ts` dosyasını oluştur.

**Kontrol:** `npm run dev` yazdığında boş bir Next.js sayfası açılıyor mu?

---

## Sprint 1: Kimlik Doğrulama (Auth) & Roller (2. Gün)

> **Durum (2026-08-31):** ✅ Sprint 1 tamamlandı — uçtan uca test edildi ve doğrulandı.
>
> - Clerk uygulaması "feedl" (`app_3Ih0Ue3SHQLk5HOOFnWEM7LD6Ze`) oluşturuldu; Clerk
>   CLI 3.2.0 ile projeye bağlandı, key'ler `clerk env pull` ile `.env.local`'e yazıldı.
> - `clerk init` mevcut dosyaları (middleware, layout, sign-in/up) SKIP etti; yalnızca
>   sign-in/up URL + fallback redirect env'lerini ekledi. Windows'ta "Scanning for
>   issues..." adımında takıldı — dosyalar yazılmıştı, sorun yok.
> - Ek düzeltmeler: matcher'a `/__clerk/(.*)` eklendi; `ClerkProvider` v7 gereği
>   `<body>` içine taşındı; `@clerk/ui` shadcn teması uygulandı; react/react-dom
>   19.2.8'e (exact) sabitlendi.
> - Layout'ta geçici üst bar (Giriş/Kayıt/UserButton) var — Sprint 2'de gerçek
>   navigasyonla değişecek.
> - Webhook akışı doğrulandı: `user.created` → 200 → `users` satırı düştü. Relay
>   URL'i Dashboard'da endpoint olarak eklendi (imza sırrı `.env.local`'de). Lokal
>   dinleyici: `clerk webhooks listen --token c_zC347Uji8e --forward-to
>   http://localhost:3000/api/webhooks/clerk` (sabit relay URL).
> - Admin: `oguzkir@gmail.com` → `role='admin'` atandı.
> - Manuel testler ✓: admin `/dashboard`'a, üye `/portal`'a yönleniyor; çıkış
>   sonrası korunan rota (`/dashboard`) giriş ekranı gösteriyor.
> - Depo: `github.com/kogu1988/feedl` (main).

**Hedef:** Giriş yapma, kayıt olma ve admin/üye ayrımı.

**Yapılacaklar:**

1. Clerk'i yükle: `npm i @clerk/nextjs`
2. `middleware.ts` dosyasını oluştur ve tüm rotaları koruma altına al. Middleware sadece giriş kontrolü yapar; admin yetkisi **Neon `users` tablosundaki `role` alanından** okunarak sayfa/API içinde kontrol edilir (tek kaynak: DB).
3. `/sign-in`, `/sign-up` sayfalarını oluştur (Clerk componentlerini kullan).
4. **Kritik Adım:** Clerk Webhook'u (`/api/webhooks/clerk`) oluştur. Kullanıcı oluştuğunda bu webhook Neon'daki `users` tablosuna otomatik kayıt atsın.
5. Admin kullanıcısını manuel olarak Neon'da `role='admin'` yap. Tüm rol kontrolleri bu tablodan yapılır.

**Kontrol:** Giriş yapınca admin `/dashboard`'e, müşteri `/portal`'a yönleniyor mu? Neon'da kullanıcı tablosu doluyor mu?

---

## Sprint 2: Müşteri Portalı (Public Read, Auth for Actions) (3. Gün)

> **Durum (2026-08-31):** ✅ Sprint 2 tamamlandı — uçtan uca test edildi (boş durum,
> validasyon hatası, fikir gönderimi, kalıcılık). Bekleyen yok.
>
> - `posts` tablosu migration'ı (0001_sprint2_posts): temel alanlar + status
>   enum + nullable AI alanları. `embedding_vector` (pgvector) ve `duplicate_*`
>   alanları Sprint 5 migration'ına bırakıldı (pgvector extension gerektirir).
> - `GET /api/posts` public (limit 100, created_at DESC); `POST /api/posts`
>   handler içinde auth (401 zarfı) + Zod validasyon (lib/validations/post.ts,
>   başlık 3-140, açıklama 10-2000).
> - `/portal`: force-dynamic server component, DB'den direkt okur; kartlar
>   (başlık, durum etiketi, tarih, özet), boş durum ve hata durumu var.
> - "Yeni Fikir Gönder" dialog'u (components/custom/new-post-dialog.tsx):
>   RHF + Zod, inline hata gösterimi, başarıda router.refresh(). Giriş yapmayan
>   kullanıcıya SignInButton ile giriş CTA'sı gösteriliyor.
> - Yeni shadcn bileşenleri Base UI tabanlı: `asChild` YOK, `render` prop'u var
>   (örn. `<DialogTrigger render={<Button />}>`).
> - Canlı API testleri ✓: GET boş zarf, POST girişsiz 401, /portal 200.
> - Bekleyen (senin testin): giriş yapıp dialog'dan fikir gönder → portalda
>   listelenmeli, DB'de görünmeli.

**Hedef:** Kullanıcıların fikirleri herkese açık şekilde görmesi; yeni fikir gönderme ve oy verme işlemlerinin giriş gerektirmesi.

**Yapılacaklar:**

1. `/portal` sayfasını oluştur.
2. `app/api/posts/route.ts` dosyasında **GET** methodu oluştur. (Tüm fikirleri listele - en son eklenen en üstte; public erişim).
3. `app/api/posts/route.ts` dosyasında **POST** methodu oluştur. (Yeni fikir ekle; sadece giriş yapmış kullanıcı).
4. `/portal` sayfasına "Yeni Fikir Gönder" butonu koy. Tıklayınca dialog açılsın. (Başlık + Açıklama).
5. Fikirleri kartlar halinde göster (Başlık, açıklama özeti, tarih).

**Kontrol:** Postman veya browser'dan bir fikir gönder, veritabanında görünüyor mu ve `/portal`'da listeleniyor mu?

---

## Sprint 3: Oy Verme Mekanizması (Voting) (4. Gün)

> **Durum (2026-08-31):** ✅ Sprint 3 tamamlandı — manuel testler geçti (oy ver/
>   geri al/kalıcılık/girişsiz CTA). İkinci hesap testi atlandı (unique kısıt DB
>   seviyesinde garantili).
>
> - `votes` tablosu (0002_sprint3_votes): `unique(user_id, post_id)` çifte oyu DB
>   seviyesinde engeller; FK'lar cascade. Post silinince oyları da gider.
> - `POST /api/votes` `{postId}` → `onConflictDoNothing` + güncel sayaç döner
>   (idempotent). `DELETE /api/votes?postId=...` → kullanıcının kendi oyunu siler.
>   Rotalar middleware'da korumalı: girişsiz isteklere Clerk **404** döndürür
>   (API rotalarında Clerk'in standart davranışı — handler'daki 401 zarfı
>   savunma katmanı olarak duruyor).
> - Portal: LEFT JOIN + GROUP BY ile `voteCount`; oturum sahibinin oyları
>   `inArray` ile çekilip butonlara başlangıç durumu olarak geçer.
> - `VoteButton` (client): POST/DELETE toggle, sayı ve durum sunucu yanıtına
>   göre güncellenir (optimistik UI yok). Girişsiz kullanıcıda buton
>   SignInButton'a dönüşür (tıklayınca giriş sayfası).
> - `GET /api/posts` artık `voteCount` döndürüyor.
> - Build ✓, migration ✓. Bekleyen: giriş yapmış oy verme/geri alma testi.

**Hedef:** Her fikrin altında oy butonu olsun. Aynı kullanıcı bir kez oy kullanabilsin.

**Yapılacaklar:**

1. `app/api/votes/route.ts` POST methodu (Oy ekle).
2. `app/api/votes/route.ts` DELETE methodu (Oy geri al - toggle).
3. `/portal`'daki her kartta bir "👍 Oy Ver (Sayı)" butonu olsun.
4. Sadece giriş yapmış kullanıcı oy kullanabilsin.
5. Veritabanı sorgusunda `votes` tablosunu `posts` ile `LEFT JOIN` yaparak toplam oy sayısını göster.

**Kontrol:** Butona tıklayınca sayı artıyor, tekrar tıklayınca azalıyor mu? Farklı kullanıcı ile girince başka hesap etkilenmiyor mu?

---

## Sprint 4: Admin Paneli & Yol Haritası (Roadmap) (5. Gün)

> **Durum (2026-08-31):** ✅ Sprint 4 tamamlandı — manuel test 4 aşamada geçti
>   (dashboard'da durum değiştirme, portala "Planlandı" badge'i olarak yansıma).
>
> - `lib/auth/admin.ts`: `getAdminUserId()` — rolun tek kaynağı DB (`users.role`);
>   sayfa ve API aynı yardımcıyı kullanıyor.
> - `/dashboard`: admin değilse `/portal`'a yönlendirilir. Tablo: oy sayısı,
>   başlık + ID, tarih ve satır içi durum dropdown'u (`StatusSelect`, Base UI
>   RadioGroup; optimistik güncelleme + hata durumunda geri alma).
> - `PATCH /api/admin/posts` `{postId, status}`: admin doğrulaması DB'den,
>   Zod ile enum doğrulama, `updatedAt` yenilenir, bulunamazsa 404 zarfı.
> - `shadcn add table` ile tablo bileşeni eklendi (registry'den eksikti).
> - Girişsiz erişim: `/dashboard` → 404/redirect, `PATCH` → 404 (Clerk
>   koruması) — canlı doğrulandı. Build ✓.
> - Production: Vercel projesi "feedl" → `https://getfeedl.vercel.app` (domain
>   kullanıcı tarafından değiştirildi; 4 uç nokta smoke testi geçti).

**Hedef:** Admin giriş yapınca özel bir panel görmeli ve fikirlerin durumunu değiştirebilmeli.

**Yapılacaklar:**

1. `app/dashboard/page.tsx` oluştur. Sadece `role='admin'` olanlar erişebilsin. Middleware sadece giriş kontrolü yapar; admin rolü **DB'deki `users` tablosundan** kontrol edilir.
2. Admin panelinde tüm fikirleri listeleyen bir tablo yap (ID, Başlık, Durum, Tarih).
3. `app/api/admin/posts/route.ts` (PATCH) methodu oluştur. Gelen `postId` ve `status`'u güncelle.
4. Tablodaki her satıra açılır menü (dropdown) koy. `open`, `planned`, `in-progress`, `shipped` seçenekleri olsun.

**Kontrol:** Admin girişi yapıp bir fikrin durumunu "planned" yap. Portal sayfasında bu fikrin üzerinde etiket olarak "Planlandı" görünüyor mu?

---

## Sprint 5: Yapay Zeka Otomasyonu (AI Autopilot) - EN KRİTİK (6. Gün)

**Hedef:** Yeni fikir gelince, Inngest background'da çalışsın; OpenRouter LLM ile etiket/özet çıkarsın, OpenRouter embedding ile vektör üretsin, pgvector ile duplicate kontrolü yapsın.

**Yapılacaklar:**

1. **Inngest Kurulumu:** `npm i inngest`
2. `app/api/inngest/route.ts` oluştur (Inngest sunucusunu bağla).
3. **Vektör (Embedding) Ayarları:** Neon'da `pgvector` eklentisini aktif et. `embedding_vector` sütununu oluştur (`vector(2048)` - `nvidia/nemotron-3-embed-1b:free` için; 2048 > HNSW limiti 2000 olduğundan index konmaz, MVP hacminde sıralı tarama yeterli).
4. **Trigger:** Yeni post oluştuğunda Inngest event'i fırlat (`post/created`).
5. **Görev 1 (Embedding & Dedup):** Yeni postun metnini **OpenRouter Embeddings API**'ye gönder (model: `nvidia/nemotron-3-embed-1b:free`, 2048 boyut). Veritabanındaki diğer postların vektörleriyle karşılaştır (Cosine similarity). **Cosine > 0.85** olan adayları `prompts.md`'deki LLM karşılaştırma promptuyla kontrol et. LLM `%90'dan fazla` aynıysa `DUPLICATE` dönerse, yeni postun `duplicate_of` alanını eski postun ID'sine ayarla ve `duplicate_note`'a `"Bu istek #<eski_post_id> ile yüksek olasılıkla tekrar (duplicate)"` notu düş.
6. **Görev 2 (LLM Etiket & Özet):** OpenRouter LLM API'ye gönder (model: `google/gemini-2.5-flash`). Prompt'u `prompts.md`'den al. Çıkan sonucu `ai_summary`, `sentiment_label` ve `ai_keywords` olarak kaydet.

**Kontrol:** Yeni bir fikir gönder. 10 saniye sonra veritabanında `ai_summary`, `sentiment_label` ve `ai_keywords` dolu mu? Benzer fikir varsa `duplicate_of` alanı dolu mu?

---

## Sprint 6: E-posta Bildirimleri (Shipped Notifications) & Deploy (7. Gün)

**Hedef:** Admin durumu "shipped" yaptığında, o isteği açan ve oy veren herkese Resend (production) veya Ethereal.email (test) ile mail gitmeli.

**Yapılacaklar:**

1. **Resend Kurulumu:** `npm i resend`, şablon oluştur (Örn: `lib/email/shipped.tsx`). Geliştirme/testte Ethereal.email SMTP ayarları kullanılır.
2. **Trigger:** Admin `PATCH` ile durumu `shipped` yaptığında Inngest event'i fırlat (`post/status.changed`).
3. **Inngest Görevi:** O posta ait tüm `votes` tablosundaki kullanıcıların ve postu oluşturan kullanıcının email'lerini çek. Her birine ayrı ayrı Resend ile mail gönder (Batch yap). Geliştirme/test ortamında Ethereal.email kullanılabilir.
4. Portal'da "Yayında" etiketi altındaki özellikleri ayrı bir liste olarak göster (Changelog mantığı).

**Final Adımı (Deploy):**

1. GitHub'a push et.
2. Vercel'e bağla.
3. Vercel ortam değişkenlerini `.env.local`'daki gibi doldur.
4. Inngest Cloud free tier'ı kullanarak background işlemleri aktif et.
5. Siteyi aç ve bir arkadaşına test ettir.

---

## Sprint 7: MVP Sonrası - CSV Dışa Aktar (Düşük Öncelik)

**Hedef:** Admin panelinden tüm fikirleri CSV olarak indirmek.

**Yapılacaklar:**

1. `app/api/admin/export/route.ts` (GET) oluştur. Sadece admin erişebilir.
2. Tüm `posts` verisini çek; başlık, durum, oy sayısı, tarih alanlarını CSV'ye dönüştür.
3. Admin paneline "CSV İndir" butonu ekle.

> Not: Bu özellik `canny.md`'de MCP sunucusu yerine planlanan basit dışa aktar işlemidir.

---

## 🚨 Önemli Notlar (AI Ajanına Uyarı)

- **Hata Yönetimi:** Her API route'unda `try-catch` kullan.
- **TypeScript:** Tüm fonksiyonlar kesinlikle tip güvenli olsun.
- **Migration:** Drizzle ile migration yapmayı unutma (`drizzle-kit generate` ve `drizzle-kit migrate`).
- **Güvenlik:** Admin route'larında mutlaka `auth()` kontrolü yap ve `role` kontrolü ekle.
