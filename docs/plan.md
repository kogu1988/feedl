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

> **Durum (2026-09-01):** ✅ Sprint 5 tamamlandı — uçtan uca test edildi.
>
> - Inngest v4 kuruldu; `app/api/inngest` serve endpoint + `inngest/` klasörü.
>   **v4 API notu:** trigger artık options içinde (`triggers: { event: ... }`),
>   3 argümanlı v3 imzası çalışmıyor. Lokal geliştirmede `INNGEST_DEV=1`
>   gerekiyor (SDK NODE_ENV'e bakmıyor); middleware'a `/api/inngest(.*)` public
>   eklendi (Inngest Cloud signing key ile doğrular).
> - Migration 0003_sprint5_ai: `CREATE EXTENSION vector` + `embedding_vector
>   vector(2048)` + `duplicate_of` (self-FK, set null) + `duplicate_note`.
> - AI stack tamamen ücretsiz: LLM `minimax/minimax-m3:free`, embedding
>   `nvidia/nemotron-3-embed-1b:free` (ikisi de OpenRouter, tek key). Gemma-4
>   429 verdigi için, nemotron-lightning formatı bozduğu için elendi.
> - **Eşik kalibrasyonu:** nemotron embedding'leriyle benzer Türkçe postlar
>   0.57-0.80 cosine verdi (0.85 eşiği ada-002 kalibrasyonuydu) → eşik 0.60'a
>   çekildi; LLM çift doğrulaması yanlış pozitifleri eler.
> - Test sonuçları: fikir postu → özet + pozitif sentiment + 3 etiket +
>   embedding ✓; kopya post → cosine 0.801 aday + LLM DUPLICATE kararı +
>   duplicate_of/duplicate_note doldu ✓. `POST /api/posts` trigger'ı try/catch
>   içinde — Inngest erişilemezse bile fikir kaydı başarılı.
> - Üretim doğrulaması (2026-09-01): `getfeedl.vercel.app/portal` üzerinden
>   "Karanlık mod desteği" fikri → ~60 sn içinde DB'de ai_summary +
>   sentiment_label (notr) + 5 ai_keywords + embedding doldu; duplicate
>   çıkmadı (doğru negatif). Uçtan uca zincir canlı: portal → post/created →
>   Inngest Cloud → OpenRouter → Neon.
> - **Üretim eşik revizyonu (2026-09-01):** canlı kopya testinde başlığı
>   farklı, gövdesi orijinal+ek olan yakın kopya 0.547 cosine verdi — 0.60
>   eşiği yakalayamadı (yerel 0.801, başlık birebir aynıydı). Alakasız
>   generic çiftler 0.489'a kadar çıkıyor; bantlar 0.45'te ayrışıyor →
>   DUPLICATE_SIMILARITY_THRESHOLD 0.45'e indirildi. Karar yine LLM'de;
>   post başına ≤1 karşılaştırma çağrısı, maliyet sınırlı. Rerun ile
>   doğrulandı: 0.547 adayı LLM DUPLICATE dedi, duplicate_of +
>   duplicate_note canlıda doldu.
> - Inngest Cloud bağlantısı Vercel entegrasyonuyla kuruldu (signing/event
>   key otomatik enjekte edildi; `getfeedl.vercel.app/api/inngest` üzerinde
>   App diagnostics 200 + tüm key'ler CORRECT). **Not:** Vercel Deployment
>   Protection, deployment URL'lerine sync'i engellediği için ("Unattached
>   syncs") uygulama production domain üzerinden manuel eklendi; entegrasyona
>   Protection Bypass key'i de girildi (bir sonraki deploy'da otomatik sync
>   test edilecek).

**Hedef:** Yeni fikir gelince, Inngest background'da çalışsın; OpenRouter LLM ile etiket/özet çıkarsın, OpenRouter embedding ile vektör üretsin, pgvector ile duplicate kontrolü yapsın.

**Yapılacaklar:**

1. **Inngest Kurulumu:** `npm i inngest`
2. `app/api/inngest/route.ts` oluştur (Inngest sunucusunu bağla).
3. **Vektör (Embedding) Ayarları:** Neon'da `pgvector` eklentisini aktif et. `embedding_vector` sütununu oluştur (`vector(2048)` - `nvidia/nemotron-3-embed-1b:free` için; 2048 > HNSW limiti 2000 olduğundan index konmaz, MVP hacminde sıralı tarama yeterli).
4. **Trigger:** Yeni post oluştuğunda Inngest event'i fırlat (`post/created`).
5. **Görev 1 (Embedding & Dedup):** Yeni postun metnini **OpenRouter Embeddings API**'ye gönder (model: `nvidia/nemotron-3-embed-1b:free`, 2048 boyut). Veritabanındaki diğer postların vektörleriyle karşılaştır (Cosine similarity). **Cosine > 0.85** olan adayları `prompts.md`'deki LLM karşılaştırma promptuyla kontrol et. LLM `%90'dan fazla` aynıysa `DUPLICATE` dönerse, yeni postun `duplicate_of` alanını eski postun ID'sine ayarla ve `duplicate_note`'a `"Bu istek #<eski_post_id> ile yüksek olasılıkla tekrar (duplicate)"` notu düş.
6. **Görev 2 (LLM Etiket & Özet):** OpenRouter LLM API'ye gönder (model: `minimax/minimax-m3:free`). Yanıtın ilk `{` ile son `}` arası çıkarılıp Zod ile doğrulanır; parse hatasında Inngest retry ile tekrar dener. Prompt'u `prompts.md`'den al. Çıkan sonucu `ai_summary`, `sentiment_label` ve `ai_keywords` olarak kaydet.

**Kontrol:** Yeni bir fikir gönder. 10 saniye sonra veritabanında `ai_summary`, `sentiment_label` ve `ai_keywords` dolu mu? Benzer fikir varsa `duplicate_of` alanı dolu mu?

---

## Sprint 6: E-posta Bildirimleri (Shipped Notifications) & Deploy (7. Gün)

> **Durum (2026-09-01):** ✅ Sprint 6 tamamlandı — üretimde uçtan uca test edildi.
>
> - Üretim testi: dashboard'dan "Karanlık mod desteği" shipped'e çekildi →
>   Inngest `notify-shipped` run çıktısı `provider: ethereal, recipients: 1,
>   sent: 1, failed: 0` + Ethereal preview URL'de e-posta dogru içerikle
>   görüntülendi; portalda "Yayında" bölümünde post doğru listede.
> - **Inngest auto-sync çözüldü:** Protection Bypass key'i entegrasyona
>   girdikten sonraki ilk deploy'da (98509c0) entegrasyon deploy URL'ine
>   sync edebildi — "Unattached syncs" sorusu kapandı, 2 fonksiyon
>   (ai-autopilot + notify-shipped) otomatik göründü.
>
> - `npm i resend nodemailer` (+ `@types/nodemailer`). Sağlayıcı seçimi
>   `lib/email/send.ts` içinde env'e göre otomatik: RESEND_API_KEY varsa
>   Resend (batch), yoksa Ethereal SMTP (nodemailer), o da yoksa uyarıyla
>   atlanır — bildirim hatası ana akışı bozmaz. Ethereal test hesabı otomatik
>   oluşturuldu (kimlik bilgileri .env.local'da, değerler loglanmaz).
> - Şablon: `lib/email/shipped.ts` (inline stilli HTML + text). Plan'daki
>   `shipped.tsx` önerisinden bilinçli sapma: react-email bağımlılığı
>   eklememek için düz HTML üretir; Resend SDK `html` kabul eder.
> - Trigger: `PATCH /api/admin/posts` eski durumu önce okur, yalnızca gerçek
>   değişimde `post/status.changed` fırlatır (prompts.md §4.2; event
>   gönderimi try/catch içinde — güncelleme event hatasından etkilenmez).
> - Inngest: `notify-shipped` (retries 3) — yalnızca `newStatus=shipped`'te
>   çalışır; alıcılar = yazar + oy verenler (tekilleştirilmiş). Silinen post
>   `NonRetriableError` ile retry döngüsünü bitirir. Event şemaları
>   `lib/validations/events.ts`'te toplandı (postCreated buraya taşındı).
> - Portal: "Yayında" bölümü (changelog mantığı, en son yayınlanan üstte,
>   oy butonu yok); aktif fikirler ayrı listede kaldı.
> - Portal linki `NEXT_PUBLIC_APP_URL` ile override edilebilir (varsayılan
>   https://getfeedl.vercel.app/portal). Gönderen: Resend'de feedl.co
>   doğrulanana kadar `onboarding@resend.dev` (yalnızca hesap sahibine
>   teslim eder); `EMAIL_FROM` ile override edilebilir. Resend'e geçiş için
>   tek adım: Vercel + .env.local'a RESEND_API_KEY girmek.

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

> **Durum (2026-09-01):** ✅ Sprint 7 tamamlandı — üretimde test edildi
>   (CSV indirildi, kolonlar ve Türkçe karakterler doğrulandı).
>
> - `app/api/admin/export/route.ts` (GET): admin-only (rol DB'den doğrulanır),
>   limit yok — tüm fikirler. Kolonlar: Başlık, Durum (Türkçe etiket),
>   Oy Sayısı, Oluşturma, Güncelleme, ID. RFC 4180 kaçışlama (virgül/tırnak/
>   yeni satır içeren alanlar güvenli) + UTF-8 BOM (Excel Türkçe karakter).
> - Dashboard'a "CSV İndir" butonu (`/api/admin/export`, `download` attr).
> - Tarih formatı tr-TR; dosya adı `feedl-fikirler-YYYY-MM-DD.csv`.

**Hedef:** Admin panelinden tüm fikirleri CSV olarak indirmek.

**Yapılacaklar:**

1. `app/api/admin/export/route.ts` (GET) oluştur. Sadece admin erişebilir.
2. Tüm `posts` verisini çek; başlık, durum, oy sayısı, tarih alanlarını CSV'ye dönüştür.
3. Admin paneline "CSV İndir" butonu ekle.

> Not: Bu özellik `canny.md`'de MCP sunucusu yerine planlanan basit dışa aktar işlemidir.

---

## Sprint 8: Portal Güçlendirme (Arama, Benzer Post Önerisi, Roadmap)

> **Durum (2026-09-01):** ✅ Tamamlandı — sprint, arama algoritması v2
> güçlendirmesiyle kapatıldı.
>
> - **Arama:** GET /api/posts?q= ve portalda ?q= (server-side, title+
>   description; 100 karakter üstü reddedilir). Başta tek parça ILIKE idi,
>   kapanışta aşağıdaki v2 algoritmaya yükseltildi. Arama kasıtlı olarak
>   embedding'siz: her tuş vuruşunda embedding çağrısı 429 riski + gecikme
>   yaratır; semantic duplicate tespiti zaten arka planda AI autopilot'ta
>   (0.45 eşik + LLM çift kontrol).
> - **Arama algoritması v2 (sprint kapanışı):** lib/post-search.ts ortak
>   modülü — (1) çok kelimeli AND eşleşme, kelime sırası önemsiz ("mod
>   karanlık" → "Karanlık mod desteği"); (2) Türkçe diakritik katlaması,
>   SQL translate+lower ile JS foldTr birebir aynı eşleme ("karanlik" →
>   "karanlık", "islem" → "İşlem"); (3) alaka sıralaması: başlık
>   eşleşmesi 2p / açıklama 1p → oy sayısı → tarih (arama yokken eski
>   davranış: en yeni üstte); (4) LIKE kaçışında ters eğik çizgi hatası
>   giderildi (eski kod "a\b" sorgusunu "ab" diye arıyordu). /api/posts ve
>   portal aynı kondisyonu kullanır; dialog önerileri de bu endpoint'ten
>   beslendiği için otomatik iyileşti.
> - **Yazarken benzer post önerisi (Canny'nin kritik duplicate önleme
>   UX'i):** NewPostDialog başlık alanında 400ms debounce + min 3 karakter
>   ile /api/posts?q= çağrısı, en fazla 5 öneri (durum etiketi + oy sayısı);
>   AbortController ile bayat istekler iptal edilir, hata öneriyi sessiz
>   geçer (form akışı etkilenmez).
> - **Public roadmap kanban:** /roadmap — Planlandı / Geliştiriliyor /
>   Yayında kolonları (kart: başlık, oy, 3 satır açıklama); middleware
>   public route'a eklendi, portaldan "Yol Haritası →" linki.
> - Ortak durum etiketleri + tarih formatları lib/post-format.ts'te
>   toplandı (portal, dialog, roadmap, export aynı kaynağı kullanır).

**Hedef:** Portalda arama, yeni fikir yazarken benzer fikir önerisi (duplicate
önleme UX'i) ve herkese açık kanban yol haritası (docs/deepseek.txt §5.A,
docs/oxalpha.txt §6 kritik UX detayları).

---

## Sprint 9: Tasarım/UI Cilası (Faz 2 adım 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üst bar + landing page üretimde
> doğrulandı (kullanıcı testi "hepsi ok"); durum etiketleri tek
> bileşende toplandı.
>
> - **Ortak site üst barı (layout.tsx):** "feedl" markası + Portal /
>   Yol Haritası linkleri + Giriş/Kayıt/UserButton; Sprint 2'deki
>   geçici barın yerine geçti. Üretimde test edildi.
> - **Landing page ("/"):** Çıkıştaki ziyaretçiye hero + 3 özellik
>   kartı + CTA ("Fikir vermeye başla" / "Fikirlere göz at"); giriş
>   yapmış kullanıcı role bazlı yönlendirmeye devam eder. Üretimde
>   test edildi.
> - **Gerçek hata giderildi:** "/" sayfasında redirect() try bloğu
>   içindeydi; NEXT_REDIRECT hatası catch tarafından yakalanıp admin
>   "/" üzerinden hep portala düşüyordu. Hedef artık try DIŞINDA
>   redirect ediliyor — admin "/" → dashboard çalışıyor (kullanıcı
>   doğruladı).
> - **StatusBadge bileşeni** (components/custom/status-badge.tsx):
>   durum renklerinin tek görsel kaynağı — Açık nötr, Planlandı mavi,
>   Geliştiriliyor amber, Yayınlandı yeşil. Portal, roadmap ve dialog
>   aynı bileşeni kullanır. Bu vesileyle export route'unun kendi yerel
>   statusLabels kopyası bulundu; lib/post-format'tan import'a
>   çevrildi ("export aynı kaynağı kullanır" kuralı ihlaliydi).

**Hedef:** Arayüzü "ürün" görünümüne kavuşturmak (referans: `DESIGN.md` —
Base UI dokümantasyonu; docs/deepseek.txt §1 Feedback Portal, docs/
oxalpha.txt §6 kritik UX detayları).

Yapılacaklar:
- **Ortak site üst barı (layout.tsx):** "feedl" markası + Portal / Yol
  Haritası linkleri + sağda Giriş/Kayıt/UserButton; Sprint 2'deki geçici
  barın yerine geçti.
- **Landing page ("/"):** Kayıt olmayan ziyaretçiye hero + özellik
  kartları + CTA gösterir; giriş yapmış kullanıcı Sprint 2'deki role
  bazlı yönlendirmeyle dashboard/portala düşer. Bu vesileyle gerçek bir
  hata giderildi: redirect() try bloğu içindeydi; NEXT_REDIRECT hatası
  catch tarafından yakalanıp admin "/" üzerinden dashboard yerine
  portala düşüyordu. Hedef artık try DIŞINDA redirect ediliyor.
- **Portal görsel cilası:** durum etiketi renkleri StatusBadge ile
  birleştirildi; kart düzeni ve boş durumlar zaten tutarlıydı, ek
  değişiklik gerekmedi.

---

## Sprint 10: Yorumlar + Post Detay Sayfası (Faz 2 adım 3)

> **Durum (2026-09-01):** ✅ Tamamlandı — çekirdek üretimde doğrulandı
> (kullanıcı testi "hepsi ok"); ek olarak otomatik durum iç notu
> eklendi, onun üretim testi bekliyor.
>
> - **EK (Sprint 10 kapanışı):** Admin durumu değiştirince detay
>   sayfasına otomatik iç not düşer: "Durum güncellendi: X → Y"
>   (statusLabels'tan etiketler; best-effort — not başarısız olsa bile
>   durum güncellemesi başarılı kalır). PATCH /api/admin/posts içine
>   gömüldü; Inngest event akışını etkilemez.
> - **comments tablosu:** post_id (FK cascade) + user_id (FK cascade) +
>   body + is_internal + created_at; index (post_id, created_at).
>   Migration 0004 canlı DB'ye drizzle-kit generate+migrate ile
>   uygulandı. Duplicate test postu "Fikir önerisi" kullanıcı onayıyla
>   DB'den silindi.
> - **POST /api/posts/[id]/comments:** giriş zorunlu; gövde 2-2000
>   karakter (Zod). is_internal bayrağı yalnızca admin oturumunda
>   dikkate alınır — istemciden gelen bayrağa güvenilmez.
> - **Post detay sayfası /portal/[id]:** tam açıklama, durum etiketi,
>   oy butonu; admin'e ai_summary kutusu ("AI Özeti — yalnızca admin").
>   Yorum listesi kronolojik; iç notlar amber "İç not" rozetiyle
>   yalnızca admin'e görünür (hem sayfa sorgusu hem render filtreli).
>   Geçersiz/uuid olmayan id → 404.
> - **Yorum formu** (components/custom/comment-form.tsx): RHF + Zod;
>   admin için "İç not" checkbox'ı (shadcn checkbox ilk kez registry'den
>   eklendi); başarıda reset + router.refresh().
> - Portal ve roadmap kart başlıkları detay sayfasına link oldu.
> - Opsiyonel sonraki adım (ertelendi): durum değişince admin'e
>   otomatik "durum güncellemesi" iç notu düşme (Canny davranışı).

**Hedef:** Fikirlere yorum yazma + admin iç notları (canny.md "MVP
sonrası"; docs/oxalpha.txt §2.A yorumlar + §G internal notes; kritik UX:
yorum yazmak etkileşimi canlandırır, internal note müşteriye görünmez).

---

## Sprint 11: AI Etiketleri + Dashboard Cilası (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi ok").
> - **SentimentBadge + KeywordChips** ortak bileşenleri; sentiment
>   etiketleri lib/post-format'a eklendi (pozitif yeşil / notr nötr /
>   negatif gül kurusu).
> - **Portal + detay sayfası AI satırı:** duygu + anahtar kelimeler
>   herkese açık (kullanıcı kararı); aiSummary admin'de kalır.
>   AI verisi olmayan postlarda satır hiç render edilmez.
> - **Dashboard cilası:** istatistik satırı (Toplam Fikir / Toplam Oy /
>   Açık / Yayınlanan — tek sorgudan JS'te hesaplanır), AI kolonu
>   (duygu + ilk 2 anahtar kelime), başlıklar detay sayfasına link.

**Hedef:** AI analizinin görünür olması (docs/oxalpha.txt §H otomatik
etiketleme; dashboard'a admin için tek bakışta durum) — docs/deepseek.txt
§2 "Analiz" adımının UI karşılığı.

---

## Sprint 12: Sıralama Sekmeleri + Dashboard Filtreleri (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **Portal sıralama sekmeleri (Canny "Top / New" modeli):** "En Çok Oy
>   Alan" (varsayılan) / "En Yeni" — ?sort= query param'ı. Arama varken
>   sekmeler gizlenir, alaka sıralaması önceliklidir. BEHAVIOR CHANGE:
>   Sprint 2'deki "en son eklenen en üstte" varsayılanı "en çok oy
>   alan" olarak değişti (Canny araştırması §2: oy en önemli sinyal).
> - **Dashboard durum filtreleri:** Tümü / Açık / Planlandı /
>   Geliştiriliyor / Yayınlandı sekmeleri — ?status= ile tabloyu
>   filtreler. İstatistik satırı her zaman tüm fikirlerden hesaplanır;
>   filtre yalnızca tabloyu etkiler. Geçersiz değer "Tümü"ne düşer.
> - Ortak **FilterTabs** bileşeni (components/custom/filter-tabs.tsx):
>   sunucu bileşenlerinde URL param'ıyla çalışan hafif sekme navigasyonu.

**Hedef:** Canny'nin kritik UX detayları (docs/oxalpha.txt §2 "En çok
istenen özellikler öne çıkar") + admin triage hızlandırma.

---

## Sprint 13: Kartlarda Yorum Sayısı (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **CommentCountBadge** (components/custom/comment-count-badge.tsx):
>   yorum sayısı rozetinin tek görsel kaynağı; 0'da hiç render edilmez,
>   tıklanınca /portal/[id]#yorumlar yorum bölümüne gider.
> - **Roadmap kartları:** durum + oy sayısının yanında yorum sayısı.
> - **Portal kartları:** Yayında ve Fikirler kartlarında aynı rozet —
>   iki liste yüzeyi arasında tutarlılık (Canny modeli: satırda
>   tartışma sinyali, oxalpha.txt §2.A comment_count).
> - **Sayı doğruluğu:** her iki sayfa oy + yorum için çift leftJoin
>   kullanıyor; join fan-out'u count değerlerini şişirdiği için
>   count → countDistinct'e çevrildi. Yorum sayısına iç notlar dahil
>   değil (join koşulunda is_internal=false filtresi).
> - Detay sayfası yorum bölümüne #yorumlar anchor'ı eklendi.

**Hedef:** Kartlardan tartışma sinyali — Sprint 10 yorum altyapısının
görünür yüzü (docs/oxalpha.txt §6 kritik UX: kullanıcı kart üstünden
tartışmanın büyüklüğünü görsün).

Yapılacaklar:
- CommentCountBadge ortak bileşeni; roadmap + portal (her iki bölüm)
  kartlarına eklendi; iç notlar sayılmıyor; countDistinct ile fan-out
  düzeltmesi; detay sayfasına yorumlar anchor'ı.

---

## Sprint 14: Boş Durum CTA'ları (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **Portal "Henüz fikir yok":** giriş yapmışa NewPostDialog CTA'sı,
>   çıkıştaya "İlk fikri sen gönder" giriş butonu.
> - **Portal arama boşluğu:** aynı CTA'lar + "Aramayı temizle" butonu
>   (/portal'a dönüp aramayı sıfırlar).
> - **Roadmap boş kolon:** "Portaldan fikir öner →" linki.

**Hedef:** Dönüşüm odaklı boş durumlar (docs/deepseek.txt §5.A feedback
portal; Canny UX: boş ekranda kullanıcıyı ilk aksiyona yönlendirmek).

Yapılacaklar:
- Portal iki boş durumuna CTA satırı (giriş durumuna göre dialog veya
  SignInButton); arama boşluğuna "Aramayı temizle"; roadmap boş
  kolonuna portal linki.

---

## Sprint 15: "Oyladıklarım" Sayfası (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **/portal/oyladiklarim:** kullanıcının oy verdiği fikirler, en son
>   oyladığı üstte. Oy geri çekme mevcut VoteButton + DELETE /api/votes
>   ile çalışır; geri çekilen fikir listeden sonraki yenilemede kalkar.
> - İki sorgu: kullanıcının oyları (unique(user_id, post_id) sayesinde
>   fikir başına tek satır) + bu fikirlerin toplam oy/yorum sayıları
>   (countDistinct, iç notlar hariç — Sprint 13 pattern'i).
> - Giriş yapılmamışsa giriş CTA'lı boş durum; hiç oy yoksa "Fikirlere
>   göz at" CTA'lı boş durum.
> - Portal başlığına "Oyladıklarım →" linki (yalnızca girişli kullanıcıya
>   görünür — Show when="signed-in").
> - Portal'daki yerel dateFormatter + summarize lib/post-format'a
>   taşındı (tek kaynak kuralı — Sprint 9 statusLabels dersi).

**Hedef:** Kullanıcının kendi oyunu takip edebilmesi (Canny "My votes";
docs/oxalpha.txt §2.A votes veri modeli).

Yapılacaklar:
- Statik rota /portal/oyladiklarim (/portal/[id] ile çakışmasız: statik
  segment önceliği + [id] uuid doğrulaması); liste + iki boş durum;
  portal linki; summarize/dateFormatter tek kaynağa taşındı.

---

## Sprint 16: Özel 404 Sayfası (Faz 2 — tasarım cilası)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **app/not-found.tsx:** feedl üst barı root layout'tan otomatik gelir;
>   görsel dil portaldaki boş durumlarla aynı (kesikli kenarlık,
>   merkezli metin). Büyük 404 + "Sayfa bulunamadı" açıklaması +
>   "Portala dön" (primary) ve "Yol Haritasına göz at" (outline)
>   butonları; CompassIcon ile boş durum ikon dili.
> - Kapsam: Next.js notFound() çağrıları (örn. /portal/<geçersiz-id>)
>   ve eşleşmeyen statik yollar. Korumalı bilinmeyen yollar middleware
>   tarafından önce sign-in'e yönlendirilir (mevcut davranış).

**Hedef:** Varsayılan Next.js 404'ünü marka diline oturtmak (Faz 2 yol
haritasındaki "Tasarım/UI cilası"nın ilk adımı; referans: `DESIGN.md`).

Yapılacaklar:
- app/not-found.tsx eklendi; planlanmış tek dosyalık değişiklik.

---

## Sprint 17: "Benzer Fikirler" Bölümü (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **Detay sayfası /portal/[id] altında "Benzer fikirler":** embedding
>   altyapısı (pgvector cosine) ile en benzer en fazla 3 fikir; Canny
>   related posts modeli.
> - **Vektör JS'e taşınmaz:** cosine benzerlik Postgres içinde skalar
>   alt sorguyla hesaplanır (`1 - (embedding <=> (select ...))`), eşik
>   0.5 — duplicate kalibrasyonuyla aynı veriye dayanır (alakasız-generic
>   ≤ 0.489, yakın-kopya ≥ 0.547; inngest/functions.ts notu).
> - İki sorgu: benzer id'ler (join'siz sıralama) + kart verisi
>   (oy/yorum sayıları countDistinct, iç notlar hariç — Sprint 13
>   pattern'i). Sorgu best-effort: başarısız olursa bölüm gizlenir,
>   sayfa bozulmaz.
> - Embedding'i olmayan fikirlerde (AI henüz çalışmadıysa) bölüm çıkmaz.

**Hedef:** Kullanıcıyı benzer fikirlere yönlendirip oy hak ettirmek;
duplicate azaltma UX'i (docs/oxalpha.txt §6 kritik UX detayları).

Yapılacaklar:
- loadSimilarPosts (skalar alt sorgu + iki aşamalı yükleme); detay
  sayfasına yorumların altına kompakt kart listesi.

---

## Sprint 18: Admin'e Yeni Fikir Bildirimi (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **Yeni Inngest fonksiyonu notify-admin-post-created:** post/created
>   event'ini dinler (ai-autopilot ile aynı event — çoklu tüketici).
> - **Alıcılar DB'den:** users.role=admin (tek kaynak); yazarın kendi
>   e-postası listeden çıkarılır — admin kendi fikri için mail almaz.
>   Admin yoksa sessizce atlanır.
> - **Şablon lib/email/admin-new-post.ts:** shipped şablonuyla aynı
>   inline-stil görsel dili; başlık + yazar + açıklama (400 karakter
>   kırpım) + "Fikri incele" butonu → /portal/[id]. Konu: 📬 Yeni fikir:
>   {başlık}. Alıcı e-postaları loglanmaz.
> - **escapeHtml lib/email/html.ts'e çıkarıldı** — shipped ve yeni
>   şablon aynı kaynağı kullanır (tek kaynak kuralı).
> - Provider seçimi değişmedi: RESEND_API_KEY varsa Resend, yoksa
>   Ethereal (mevcut sendEmails akışı).
> - **Ethereal test hesabı değişti (2026-09-01):** eski hesap hatalıydı;
>   yeni hesap retha10@ethereal.email. Kimlik bilgileri .env.local ve
>   Vercel production env'lerinde güncellendi + redeploy yapıldı
>   (şifre hiçbir dosyaya yazılmaz). Gelen kutusu: ethereal.email.

**Hedef:** Admin yeni fikirden anında haberdar olsun — triage hızlanır
(Canny'nin admin notification modeli; docs/deepseek.txt §2 ekip akışı).

Yapılacaklar:
- notifyAdminNewPost fonksiyonu + serve() kaydı; e-posta şablonu;
  escapeHtml ortaklaştırması.

---

## Sprint 19: Markalı Hata Sayfası (Faz 2)

> **Durum (2026-09-01):** ✅ Tamamlandı — üretimde doğrulandı (kullanıcı
> testi "hepsi tamam").
> - **app/error.tsx (client component):** beklenmeyen çalışma zamanı
>   hatalarında 404 ile aynı görsel dili kullanan karşılama (uyarı
>   ikonu + "Bir şeyler ters gitti" + açıklama). "Tekrar dene" butonu
>   reset() ile segmenti yeniden render eder; "Portala dön" çıkışı var.
> - Hata detayı kullanıcıya gösterilmez; yalnızca tarayıcı konsoluna
>   yazılır (docs/standarts.md sızıntı kuralı).
> - Kapsam notu: root layout'un kendisindeki hatalar için global-error
>   gerekir; MVP'de gerek görülmedi (üst bar statik, risk düşük).

**Hedef:** Çalışma zamanı hatalarında bile marka deneyiminin bozulmaması
(404'ün kardeşi; Faz 2 tasarım cilası).

Yapılacaklar:
- app/error.tsx eklendi; planlanmış tek dosyalık değişiklik.

---

## 🗺️ Faz 2 Yol Haritası (2026-09-01 güncellemesi)

Canny araştırmasına (docs/deepseek.txt, docs/oxalpha.txt) dayalı plan;
**domain gerektiren faz ertelendi** (henüz domain alınmayacak):

- **Ertelendi (domain alımına kadar):** Domain bağlama (feedl.co + wildcard
  DNS), Organizations / çoklu müşteri + subdomain (`acme.feedl.co`), Widget
  SDK (`widget.js` + iframe overlay + Secure Identify — Canny modeli:
  SDK identify + data-canny-link yakalama, developers.canny.io'dan
  doğrulandı). Domain alındığında bu sprintler aktifleşecek.
  (Faz 3 güncellemesi: Widget custom domain gerektirmediğinden Sprint
  32'ye alındı; Organizations/subdomain + domain Sprint 37'de.)
- **Sıradaki (özellik + arayüz/tasarım odağı):**
  1. Tasarım/UI cilası (referans: `DESIGN.md` — Base UI dokümantasyonu;
     ilk adım özel 404 sayfası, Sprint 16).
  2. Detay sayfasına "Benzer fikirler" bölümü (pgvector cosine
     similarity — mevcut embedding altyapısı yeniden kullanılır,
     Canny'nin related posts modeli).
- Not: Ara adımlar tamamlandı — public roadmap kanban (Sprint 8),
  yazarken benzer post önerisi (Sprint 8), yorumlar + iç notlar
  (Sprint 10); kartlara yorum sayısı (13), boş durum CTA'ları (14) ve
  "Oyladıklarım" sayfası (15) Sprint 13-15'te eklendi.
- Not: Ücretsiz LLM'de ara sıra 429 (upstream rate limit) normal;
  Inngest retry mekanizması zaten telafi ediyor. Sıklaşırsa tek satırlık
  model değişikliğiyle ücretli fallback'e geçilir (bkz. skill fallback).

---

## 🧭 Faz 3 Yol Haritası: Canny Fonksiyonel Parite (2026-09-01)

Kaynak: `docs/Feedl–Canny Fonksiyonel Parite Analizi.md` (P0–P5
önceliklendirilmiş yol haritası + kabul kriterleri §6). **Kısıt: Domain
gerektiren işler ve Resend geçişi en sonda** (kullanıcı kararı).

### Analiz doğrulaması (rapor vs mevcut repo)

Raporun konum değerlendirmesi eski bir commit'e (51d10f27) dayanıyor;
aşağıdaki maddeler o zamandan beri tamamlandı ve raporun "eksik"
dediği yerler güncel değil:

- **Yorumlar + iç notlar (public/internal):** Sprint 10 — `comments`
  tablosu + `isInternal` var; rapor §1'deki "Comments yok" ifadesi
  güncel değil.
- **Fikir detay sayfası (P0.3):** Sprint 10 + 13 + 17 — kalıcı URL, tam
  açıklama, oy durumu, yorumlar, yorum sayısı ve "benzer fikirler"
  bölümü mevcut.
- CSV export (Sprint 7), admin filtre/sıralama (Sprint 12), admin'e yeni
  fikir bildirimi (Sprint 18), "Oyladıklarım" (Sprint 15), roadmap
  kanban + arama + yazarken benzer öneri (Sprint 8).
- AI özet/sentiment/keyword/duplicate adayı (Sprint 5) — rapor P5'in
  "temel AI paritesi var" tespitini doğruluyor.

### Raporun doğru tespit ettiği sınırlar

- `duplicateOf` alanı var ama operasyonel **merge/unmerge yok** (P1.2).
- "Yayında" listesi bağımsız **changelog** değil (P2.1).
- 4 sabit status; **status history** yok (P1.5).
- Yorumlarda thread/edit/delete/bildirim yok (P1.1 revizyon).
- Admin'de bulk action/saved view/tag/owner yok (P1.3, P1.4).
- Arama ILIKE; full-text/vector hybrid yok (rapor §5).
- Bildirim yalnızca shipped e-postası; takip/tercih yok (P2.3).
- Raporlama/analitik yok (rapor §1).

### Analiz gözden geçirmesi (2026-09-02): mevcut / revizyon / eklenecek

Rapor §1'deki alan tablosunun güncel repo durumuyla satır satır
sınıflandırması (✅ = parite var, 🔧 = revizyon genişletmeli,
➕ = yeni eklenecek; sprint numaraları Faz 3 listesine bağlı):

**Bizde mevcut (raporun yanlış "eksik" dedikleri dahil):**
- ✅ Public portal + arama + yeni fikir formu + yazarken benzer öneri
  (Sprint 2, 8) — P0.3'ün büyük kısmı karşılanmış durumda.
- ✅ Upvote: kullanıcı başına tek oy, geri alma, sayaç (Sprint 3).
- ✅ Status/roadmap: 4 statü + public kanban (Sprint 4, 8).
- ✅ Yorumlar (public/internal) — Sprint 10; rapor §1 "Comments yok"
  ifadesi güncel değil. İç notlar tüm okuma yollarında server-side
  filtreleniyor (bkz. skill).
- ✅ Fikir detay sayfası (P0.3): kalıcı URL, tam açıklama, oy durumu,
  yorumlar, benzer fikirler (Sprint 10, 13, 17).
- ✅ Merge/unmerge + oy/yorum taşıma + audit (P1.2, Sprint 20).
- ✅ Post tipi (feature/bug/usability) + serbest etiketler + ?tag=
  filtreleri (P1.3 lite, Sprint 21).
- ✅ Admin filtre/sıralama (Sprint 12), CSV export (Sprint 7),
  admin'e yeni fikir bildirimi (Sprint 18), "Oyladıklarım" (Sprint 15).
- ✅ AI özet/sentiment/keyword/duplicate adayı (Sprint 5) — P5 temeli.

**Revizyon gerektirenler (mevcut yapı genişletilecek):**
- 🔧 Yorumlar (P1.1): threaded reply, edit/delete, admin etiketi,
  yorum bildirimi + mention → **Sprint 24** (mention, 2026-09-02
  gözden geçirmesiyle Sprint 24 kapsamına eklendi).
- 🔧 Status yaşam döngüsü (P1.5): `under-review` + `closed` statüleri,
  `post_status_history`, değişim açıklaması → **Sprint 23**.
- 🔧 Admin triage (P1.4): bulk actions, saved views, server-side
  pagination → **Sprint 22**.
- 🔧 "Yayında" listesi → bağımsız changelog (P2.1) → **Sprint 25**.
- 🔧 Bildirim: yalnızca shipped e-postası → takip + tercihler +
  unsubscribe (P2.3) → **Sprint 26**.
- 🔧 Arama: ILIKE → PostgreSQL full-text + trigram + hybrid (rapor §5)
  → **Sprint 27**.
- 🔧 Internal roadmap/scoring (P2.2): owner, target date, RICE →
  **Sprint 28** (Sprint 21'de kararlaştırıldığı gibi ayrı categories
  tablosu YOK; custom_field_definitions/values tabloları P1.3'ün
  kalanı olarak Sprint 28'de değerlendirilecek opsiyon — ilk sürümde
  owner/eta/effort/impact sütunları yeterli).
- 🔧 AI: post-sonrası işleme → Autopilot inbox (kaynak, güven skoru,
  approve/reject/merge/spam, audit) (P5) → **Sprint 33**.
- 🔧 Raporlama (rapor §1): dashboard analytics → **Sprint 29**.

**Eklenecekler (yeni modeller/sayfalar):**
- ➕ Changelog entry/post-link tabloları + public `/portal/changelog`
  (P2.1) → **Sprint 25**.
- ➕ `post_followers` / bildirim tercihleri / `email_deliveries`
  (P2.3) → **Sprint 26**.
- ➕ `companies` + `company_members` + müşteri sayacı (P3.1) →
  **Sprint 30**.
- ➕ Opportunities + gelir ağırlıklı öncelik (P3.2) → **Sprint 31**.
- ➕ Widget SDK + imzalı JWT identify (P4.1 lite; domain gerektirmez)
  → **Sprint 32**.
- ➕ Public API `/api/v1` + scope'lu key + webhook'lar (P4.2) →
  **Sprint 34**.

**Domain + Resend ile en sona ertelenenler (kullanıcı kısıtı):**
- ⏸️ P0.1 Workspace/Organization + Board veri modeli (çoklu tenancy).
- ⏸️ P0.2 Board erişim politikaları — private comments (P1.1'in
  board'a bağlı `private` visibility kısmı) bu modele bağlı.
- ⏸️ P4.3 üçüncü taraf entegrasyonları (Slack/Intercom/Jira...).
- ⏸️ Billing/plan limitleri, custom domain + markalama, Organizations
  subdomain'leri.
- ⏸️ Resend geçişi (tek env `RESEND_API_KEY`; domain doğrulaması ile).

### Sprint listesi (☐ = planlandı)

- ✅ **Sprint 20 — Post Merge/Unmerge (P1.2)** (2026-09-01, commit 29aead5,
  üretimde doğrulandı): `posts.mergedIntoId/mergedAt` +
  `votes/comments.mergedFromPostId` + `post_merges` audit tablosu
  (migration 0005+0006). Merge/unmerge tek atomik CTE statement'ı ile
  yürütülür (neon-http `db.transaction()` desteklemiyor — bkz. skill).
  Kaynak fikir portal/roadmap/benzer fikirlerden gizlenir; detay
  sayfasında amber banner + hedef linki; dashboard'da "Birleştirildi"
  rozeti. Birleşmiş fikre oy/yorum API'leri 400 döner. Hedefi birleşmiş
  fikir hedef seçilemez (zincir yok); iki fikre de oy veren kullanıcının
  kaynak oyu taşınmaz (unique kısıt korunur). Admin arayüzü: detay
  sayfasında aramalı hedef seçici (GET /api/admin/posts?q=) + geri alma
  butonu (merged_from_post_id iziyle yalnızca taşınan satırlar döner).
- ✅ **Sprint 21 — Etiketler + Kategoriler + Post Tipi (P1.3 lite)**
  (2026-09-01, commit 303a189, üretimde doğrulandı): `posts.postType`
  enum (feature/bug/usability — Canny "category" kavramının karşılığı)
  + `tags`/`post_tags` serbest form etiketleri. Kapsam kararı: ayrı
  categories tablosu YOK — tek taksonomi (postType yapılandırılmış tür,
  tags serbest etiket). AI prompt'a `type` alanı eklendi
  (docs/prompts.md §1 + lib/ai/prompts.ts senkron); autopilot yeni
  fikirde postType doldurup keyword'leri normalizeTags ile (Türkçe
  lowercase, max 5, 2-30 krk) tags'a yazıyor. Portal + dashboard'da
  ?tag= filtre sekmeleri (FilterTabs artık extraParams ile diğer
  parametreleri koruyor); kartlarda TypeBadge + tıklanabilir TagChips
  (etiketi olmayan eski fikirlerde KeywordChips fallback). Admin detay
  sayfasında tür seçici (PATCH /api/admin/posts artık status ve/veya
  postType kabul eder; değişim otomatik iç not düşer). CSV'ye Tür +
  Etiketler kolonları. Eski 3 fikir için etiket backfill yapıldı
  (postType null — admin manuel set eder).
- ✅ **Sprint 22 — Admin Bulk Actions + Kayıtlı Görünümler (P1.4)**
  (2026-09-02, commit c352fa4, üretimde doğrulandı — kullanıcı testi
  "hepsi tamam"): `saved_views` tablosu (migration 0008, params
  query-string olarak saklanır); `POST /api/admin/posts/bulk`
  (postIds + status/addTagId; yalnızca gerçekten değişenlere
  post/status.changed event'i + özet iç notu; etiket bağlama
  onConflictDoNothing); `GET/POST/DELETE /api/admin/views`.
  Dashboard: `PostsTable` (satır checkbox'ı + seçili çubukta toplu
  durum/etiket dropdown'ları + Seçimi temizle) ve `SavedViewBar`
  (aktif filtre kombinasyonunu adla kaydet, tek tıkla aç, X ile sil).
  Tekil StatusSelect satırda korunur; selection yalnızca istemci
  state'i, işlem sonrası router.refresh(). Server-side pagination
  kapsam dışı bırakıldı (mevcut limit(200) yeterli — ileride
  gerekirse ayrı sprint).
- ✅ **Sprint 23 — Status Yaşam Döngüsü Genişletme (P1.5)**
  (2026-09-02, commit 8fef6e5 + UX düzeltmesi 9087e79, üretimde
  doğrulandı — kullanıcı testi "her şey tamam"): `under-review`
  (İncelemede, menekşe rozet) + `closed` (Kapatıldı, üstü çizili)
  statüleri (migration 0009); `post_status_history` tablosu — tekil
  PATCH ve bulk rotalarında best-effort yazım; değişim açıklaması
  (bulk çubuğunda 500 krk textarea) → event'in opsiyonel `note` alanı
  → shipped e-postasında "Ekibin notu" bloğu (html + text, escapeHtml).
  StatusBadge/FilterTabs/CSV etiketleri yeni statülerle genişledi.
  **Roadmap kararı:** kolonlar planned/in-progress/shipped kaldı;
  under-review ve closed roadmap dışında (Canny modeli). Dashboard
  filtre sekmeleri enum'dan otomatik geldi. **UX düzeltmesi:**
  StatusSelect stale local state yerine optimistik + prop-tabanlı
  değer + RadioGroup key remount (dropdown işareti sayfa yenilemeden
  güncellenir). **Not:** bildirim testi ikinci kullanıcı (retha10@
  ethereal.email kaydı) ile yapılacak; tek kullanıcılı DB'de mail
  yalnızca yazar/oy verene gider (admin'e gitmez).
- ✅ **Sprint 24 — Yorum Revizyonu (P1.1)** (2026-09-02, commit
  8ad6cd4 + migration düzeltmesi be8ba2f, üretimde doğrulandı —
  kullanıcı testi, iki kullanıcıyla): `comments.parent_id` (TEK SEVİYE
  thread; parent'a parent olamaz — API 400) + `comments.edited_at`
  (migration 0010); `PATCH/DELETE /api/comments/[commentId]` (kendi
  yorumu herkes, admin herkesinki; silmede cascade yanıt); CommentCard
  bileşeni (düzenle/sil/yanıt, "(düzenlendi)", silme onayı) + CommentForm
  yanıtı modu (parentId + İptal); portal detayında girintili yanıt
  render'ı. **Bildirim:** Inngest `notify-comment-created`
  (post/comment.created; alıcılar DB'den: fikir yazarı + parent yorum
  yazarı, yorumcu hariç; iç notlara bildirim yok) + lib/email/comment.ts
  ("Fikrine yeni yorum" / "Yorumuna yanıt geldi", ideaUrl detay linki).
  **Kapsam dışı (ileride):** @mention etiketleme; satır-bazlı status
  değişiminde not girişi (not yalnızca bulk çubuğunda — kullanıcı testi
  bu yolla: satırı seç → açıklama yaz → durumu değiştir).
- ✅ **Sprint 25 — Bağımsız Changelog (P2.1)** (2026-09-02, commit
  6b86248 + buton kilidi düzeltmesi 3b77c19, üretimde doğrulandı):
  `changelog_entries` + `changelog_post_links` (migration 0011,
  oluşum DB'de ayrıca doğrulandı); public `/portal/changelog` (iki
  aşamalı yükleme, fan-out yok; label rozetleri yeni/iyileştirme/
  düzeltme); admin panel dashboard'da (duyuru yaz + shipped fikirlere
  bağla + sil) + header'a "Güncellemeler" linki. **25a:** StatusSelect
  durum değişiminde opsiyonel açıklama dialog'u (bulk ile aynı `note`
  kanalı → history + shipped e-postası). **UX düzeltmesi:** optimistic
  state başarıdan sonra sıfırlanmadığı için dialog butonu kilitli
  kalıyordu — sıfırlama eklendi. **Kapsam dışı:** markdown render
  (şimdilik pre-line düz metin).
- ✅ **Sprint 26 — Bildirim Merkezi + Post Takibi (P2.3)** (2026-09-02,
  commit 5e08f99, üretimde doğrulandı — kullanıcı testi, iki kullanıcıyla):
  `post_followers` (yazar + oy veren + yorum yazan otomatik takipçi;
  mevcut veri backfill edildi); bildirim alıcıları artık takipçilerden
  gelir (Canny modeli); **tüm** durum geçişleri bildirir — shipped kutlama
  maili, diğerleri "📌 Takip ettiğin fikir güncellendi" (yeni şablon
  lib/email/status-update.ts, not bloğu dahil); `email_deliveries`
  (user_id+type+entity_id unique) ile idempotency — event replay/tekrar
  shipped mükerrer mail göndermez; users tablosuna tercih kolonları
  (email_status_updates/email_comments) + unsubscribe_token (migration
  0012); token'lı unsubscribe `/api/unsubscribe?token&type` — tercihi
  kapatır, markalı onay sayfası döner; tüm şablonlarda alıcıya özel
  "Bildirimleri kapat" linki (her alıcı için ayrı render).
  **Not:** Unsubscribe URL'si /api/... görünümünde — ileride şık route'a
  taşınabilir (estetik).
- ☐ **Sprint 27 — Arama Güçlendirme (rapor §5):** PostgreSQL full-text
  (Türkçe) + trigram; mevcut vector skorla hybrid sıralama;
  `lib/post-search.ts` tek kaynak kalır.
- ☐ **Sprint 28 — Internal Roadmap + Scoring (P2.2):** admin'de owner,
  target date, effort/impact, basit RICE skoru; public roadmap'ten ayrı
  internal görünüm.
- ☐ **Sprint 29 — Temel Analytics (rapor §1):** dashboard özet
  metrikleri (haftalık yeni fikir/oy/yorum, en çok istenenler,
  sentiment dağılımı); CSV export'u genişlet.
- ☐ **Sprint 30 — Company/Segment Profili (P3.1):** `companies` +
  `company_members` + user profil alanları; fikir başına "kaç müşteri
  istedi" sayacı (Canny kritik UX'i).
- ☐ **Sprint 31 — Opportunities + Gelir Ağırlıklı Öncelik (P3.2):**
  fırsat/değer alanları; oy sayısı + MRR ağırlıklı skor raporu.
- ☐ **Sprint 32 — Widget SDK (P4.1 lite):** (domain gerektirmez —
  önceki kararı koru) `<script>` + iframe overlay ile portal gömme;
  güvenli identify için imzalı kısa ömürlü JWT + origin allowlist.
- ☐ **Sprint 33 — Autopilot Inbox (P5):** AI önerileri için admin
  inbox (kaynak, güven skoru, önerilen aksiyon); approve/reject/edit/
  merge/spam; audit log.
- ☐ **Sprint 34 — Public API + Webhooks (P4.2):** scope'lu API key;
  `/api/v1` altında posts/votes/comments okuma; `post.created`,
  `post.status_changed`, `comment.created` webhook'ları; imza + rate
  limit + pagination.

### Ertelenen blok (en son — kullanıcının kısıtı)

- **Resend geçişi:** tek env `RESEND_API_KEY`; kod otomatik geçer
  (`lib/email/send.ts`). Domain doğrulaması gerektiğinden domain ile
  birlikte yapılır.
- **Domain gerektirenler:** Workspace/Organizations + çoklu tenancy
  (P0.1) + subdomain yönlendirme, board erişim politikaları (P0.2),
  custom domain + markalama, üçüncü taraf entegrasyonları (P4.3:
  Slack/Intercom/Jira...), billing/plan limitleri.

### ⚠️ Mimari risk notu (P0.1 ertelenmesi hakkında)

Rapor, workspace/board modelini "önce yapılmalı" (P0) diye işaretliyor;
ancak feedl MVP'de tek workspace/tek admin geçerli ve Organizations
domain gerektirdiğinden ertelendi. Riski azaltmak için Sprint 20–34'te
oluşturulacak tüm yeni tablolar (changelog, followers, companies vb.)
tek migration ile `workspaceId` eklenebilecek şekilde tutulur (rapor
§5 migration stratejisi).

---

## 🚨 Önemli Notlar (AI Ajanına Uyarı)

- **Hata Yönetimi:** Her API route'unda `try-catch` kullan.
- **TypeScript:** Tüm fonksiyonlar kesinlikle tip güvenli olsun.
- **Migration:** Drizzle ile migration yapmayı unutma (`drizzle-kit generate` ve `drizzle-kit migrate`).
- **Güvenlik:** Admin route'larında mutlaka `auth()` kontrolü yap ve `role` kontrolü ekle.

---

## 📚 Referans Dokümanlar

- **`DESIGN.md` (repo kökü) — TASARIM REFERANSI:** Planlamanın ilerleyen
  bölümlerinde görsel/UX tasarım ve bileşen işlerine çalışırken bu dosyaya
  bakılacak: `@base-ui/react` (Base UI) dokümantasyonu — shadcn/ui
  bileşenlerinin altındaki headless kütüphane. Yeni bileşen/tasarım işinde
  önce buradaki ilgili bileşen/handball sayfasına başvur.
- **`docs/Feedl–Canny Fonksiyonel Parite Analizi.md` — PARİTE HARİTASI:**
  Canny resmi özellik kataloğuna dayalı P0–P5 önceliklendirilmiş analiz
  (mevcut konum değerlendirmesi, eksikler, kabul kriterleri §6, mimari
  dönüşüm §5). Faz 3 sprint listesi (Sprint 20–34) buradan türetildi.
  Yeni özellik eklerken önce ilgili P maddesini ve kabul kriterini
  kontrol et. Not: raporun "mevcut durum" satırları eski commit'e
  dayanır; güncel durum için plan.md'deki "Analiz doğrulaması"
  bölümüne bak.
- **`docs/deepseek.txt` ve `docs/oxalpha.txt` — CANNY ARAŞTIRMASI:** Çeşitli
  AI modellerinden toplanan Canny platform analizleri (özellik seti,
  durum/roadmap/changelog modelleri, monetizasyon, veri şeması, kritik UX
  detayları). Yeni özellik planlarken veya UX kararı verirken önce bu iki
  dosyadaki ilgili bölüme bak (örn. canlı oy güncelleme, benzer post önerisi,
  "Complete olunca oylayıcılara kişisel e-posta" gibi Canny'yi Canny yapan
  detaylar oxalpha.txt §6'da).
