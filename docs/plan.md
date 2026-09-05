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
>   https://feedl.app/portal). Gönderen: Resend'de feedl.app
>   doğrulanana kadar `onboarding@resend.dev` (yalnızca hesap sahibine
>   teslim eder); `EMAIL_FROM` ile override edilebilir (feedl <no-reply@mail.feedl.app>).
>   Resend'e geçiş için tek adım: Vercel + .env.local'a RESEND_API_KEY girmek
>   + feedl.app (sending: mail.feedl.app subdomaini) doğrulamak (SPF/DKIM/DMARC).

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
**domain 2026-09-04'te alındı (feedl.app)** — domain gerektiren faz aktifleşti:

- **Domain bilgisi (feedl.app):** Alanadı alındı; canlı URL `https://feedl.app`,
  kurumsal mail `hi@feedl.app` (Squarespace mail yönlendirme → kişisel adrese
  iletilir), mail gönderimi Resend ile bağlanacak (SPF/DKIM/DMARC DNS + Vercel
  domain + SSL gerekir — kod tarafı fallback'ler ve email from adresleri
  feedl.app / no-reply@mail.feedl.app olarak güncellendi).
- **Artık aktifleşen sprintler:** Domain bağlama (feedl.app + wildcard
  DNS), Organizations / çoklu müşteri + subdomain (`acme.feedl.app`),
  Widget SDK, custom domain + markalama, Resend geçişi. DNS/Vercel/Resend
  wiring'i kod dışı; ilgili sprint'lerde env ve kod değişiklikleri yapılır.
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
- ✅ **Sprint 27 — Arama Güçlendirme (rapor §5)** (2026-09-02, commit
  494ed6a + koşul düzeltmeleri ff95b60/28e05c6, üretimde terminal ile
  doğrulandı): 4 katmanlı hibrit arama, lib/post-search.ts tek kaynak:
  (1) fold-ILIKE (mevcut), (2) PostgreSQL full-text — posts.search_vector
  GENERATED kolon to_tsvector('turkish',...) + GIN index (migration 0013,
  oluşum DB'de doğrulandı), (3) pg_trgm — extension + trigram index
  MANUEL uygulandı (drizzle üretmez); koşulda 4+ krk token'larda
  word_similarity > 0.55, skorda token başına greatest(word_similarity),
  (4) pgvector — YALNIZCA ilk arama boş dönerse fallback: sorgu embed
  edilir, en yakın 5 fikir + 0.10 tabanı (bu modelin mutlak benzerlik
  dağılımı düşük: anlamlı çiftler 0.10-0.25 bandında; sabit eşik
  çalışmıyor). Portal iki aşamalı: boş sonuç olmadıkça OpenRouter
  çağrılmaz. **Not:** pg_trgm extension/index yeni ortamda manuel
  kurulmalı; arama sırasında filtre sekmeleri gizli (Sprint 12 davranışı).
- ✅ **Sprint 28 — Internal Roadmap + Scoring (P2.2)** (2026-09-03,
  commit b90e7c3 + ownerId düzeltmesi 5de97ad, üretimde terminal ile
  doğrulandı): posts tablosuna owner_id (FK users, set null),
  target_date (date), impact/effort (int 1-3) kolonları (migration
  0014, DB'de doğrulandı); PATCH /api/admin/posts ownerId/targetDate/
  impact/effort kabul eder (hepsi opsiyonel, null = temizle; ownerId
  için kullanıcı varlık kontrolü); dashboard'da "İç Roadmap
  (Planlama)" kartı + components/custom/roadmap-planner.tsx (owner
  seçimi, hedef tarih, etki/efor 1-3, skor = etki/efor gösterge;
  alan değişimi anında tek PATCH atar). Müşteri tarafına sızmaz
  (portal/roadmap değişmedi). **Ders:** Clerk user ID'ler UUID
  değildir (`user_...`) — ownerId önce z.uuid() ile doğrulanınca
  PATCH 400 döndü ("Geçersiz fikir kimliği veya durum.");
  z.string().min(1) + varlık kontrolü ile düzeltildi.
- ✅ **Sprint 29 — Temel Analytics (rapor §1)** (2026-09-03, commit
  dfdbc7d + 0932fa9; kullanıcı kontrol listesiyle doğrulandı):
  dashboard'a "Analitik" kartı eklendi (components/custom/
  analytics-overview.tsx — salt sunum). Son N gün sayaçları (yeni
  fikir/oy/yorum; iç notlar hariç) üç paralel count sorgusuyla
  (loadWeeklyCounts); duygu dağılımı ve en çok istenenler top 5 mevcut
  fikir listesinden JS'te hesaplanır (ekstra sorgu yok; birleşmiş
  fikirler hariç). Dönem seçici FilterTabs ile ?range=7|14|30|365
  (durum/etiket filtreleri extraParams ile korunur). CSV export'a
  Açıklama, Duygu, Anahtar Kelimeler ve Yorum Sayısı (iç notlar
  hariç) sütunları eklendi.
- ✅ **Sprint 30 — Company/Segment Profili (P3.1)** (2026-09-03, commit
  214c024; kullanıcı kontrol listesiyle doğrulandı): `companies` +
  `company_members` tabloları (migration 0018, MRR `numeric(12,2)`)
  ve CRUD API'leri (`app/api/admin/companies` + `members`).
  Dashboard'a "Şirketler" sayfası (components/custom/
  companies-manager.tsx — form dialog, üye ekleme, ünvan düzenleme,
  silme onaylı). Ortak sayaç helper'ı (lib/db/customer-counts.ts):
  `votes ⋈ companyMembers` ile fikir başına distinct şirket sayısı.
  Dashboard fikirler tablosuna "Müşteri" kolonu; fikir detayda admin
  kutusu ("X müşteri bu fikre oy verdi"); CSV export'a "Müşteri
  Sayısı" sütunu. Widget ziyaretçileri (şirket üyeliği yok) bilinçli
  olarak sayılmaz.
- ✅ **Sprint 31 — Opportunities + Gelir Ağırlıklı Öncelik (P3.2)**
  (2026-09-04, commit 072af7e + bağlama UI adfbfe1; terminal/DB testi +
  kullanıcı kontrol listesiyle üretimde doğrulandı): `opportunities` +
  `post_opportunities` tabloları (migration 0019 — companyId FK, title,
  dealValue numeric(12,2), stage open/proposal/won/lost,
  expectedCloseDate, notes). CRUD API (`app/api/admin/opportunities`)
  + fikir↔fırsat bağlama API (`links/route.ts`, idempotent). Şirketler
  sayfasında fırsat kartları + OpportunityFormDialog (create/edit).
  Gelir skoru (lib/db/revenue-scores.ts): Skor = Oy + 10×Müşteri +
  (MRR + Açık Fırsat)/1000; yalnızca open/proposal aşaması sayılır
  (won → MRR'de zaten var, lost → gelir vaadi yok). Dashboard
  fikirler tablosuna "Skor" kolonu (tooltip'te formül), fikir detay
  sayfasına "Fırsatlar (yalnızca admin)" kutusu (bağla/kaldır —
  opportunity-link-controls.tsx), CSV export'a "Gelir Skoru" sütunu.
  Not: formül bin TL ölçeğinde — küçük fırsat değerleri (örn. 7 TL)
  skoru kıpırdatmaz, tasarım gereği.
- ✅ **Sprint 32 — Widget SDK (P4.1 lite)** (2026-09-03, commit b188c51
  + çift-prefix düzeltmesi 04d6b02, üretimde hem terminal E2E (6/6) hem
  kullanıcı tarayıcı testi ile doğrulandı): `public/widget.js` launcher
  (sağ altta yüzen buton) + `/widget` sayfası iframe overlay olarak
  portalı gömer; `data-feedl-url`, `data-token`, `data-button-text`
  öznitelikleri. Kimlik: `/api/widget/session` imzalı kısa ömürlü JWT
  payload'ı doğrular (FEEDL_WIDGET_SECRET), kullanıcıyı widget kullanıcı
  id'si ile upsert eder, 12 saatlik httpOnly SameSite=None çerezi
  verir; origin (widgetOrigin) posts'a kaydedilir. POST
  `/api/widget/posts` + GET/POST/DELETE `/api/widget/votes` (DELETE
  postId'yi query param alır). Allowlist (FEEDL_WIDGET_ALLOWED_ORIGINS)
  boş = her origin kabul (MVP kararı). **Bug:** verifySessionPayload
  sub'a toWidgetUserId'i ikinci kez uyguluyordu → FK ihlali 500;
  tek satırla düzeltildi. /dashboard/widget'ta snippet üretici form.
- ✅ **Sprint 33 — Autopilot Inbox (P5)** (2026-09-03, commit 31a1247
  + dashboard kartı 86ab4c2, unmerge iyileştirmesi 953d7eb, filtre UX
  f31990a; kullanıcı kontrol listesiyle doğrulandı): ai_suggestions
  tablosu (pending/approved/rejected/ignored; payload: duplicateOf,
  similarity, note; confidence 0-100). ai-autopilot duplicate kararını
  artık otomatik UYGULAMAZ — pending öneri olarak inbox'a düşer (Sprint
  5 davranış değişikliği). GET /api/admin/inbox + POST
  /api/admin/inbox/[suggestionId] (approve → mergePosts, reject,
  ignore); dashboard'da Autopilot Inbox kartı (kaynak başlık, güven
  skoru, önerilen hedef). Unmerge, approved duplicate önerisini
  pending'e döndürür — admin bu kez reddedebilir (red/ignore geri
  açılmaz); eski kodla geri alınıp yapışık kalan öneri tek seferlik
  veri düzeltmesiyle açıldı. **UX:** FilterTabs client bileşeni oldu —
  sekme/etiket filtreleri sayfa yenilenmeden ve kaydırma olmadan
  güncellenir (useTransition + optimistik vurgu).
- ✅ **Sprint 34 — Public API + Webhooks (P4.2)** (2026-09-03, commit
  f7fca9f + 1771503; kullanıcı kontrol listesiyle doğrulandı):
  api_keys (SHA-256 key_hash + prefix + scopes=['read'], revoke =
  revokedAt) ve webhook_endpoints (url, events varchar[], secret,
  active) tabloları (migration 0017). lib/api-keys.ts: fk_live_<32hex>
  üretim, Bearer doğrulama, süreç-içi kayan pencere 60 ist/dk rate
  limit (serverless'ta instance başına best-effort). Public okuma API'si:
  GET /api/v1/posts (page/limit≤100/status/tag/sort=top|recent;
  birleşmiş fikirler hariç, iç notlar hariç, aiSummary dışarı sızmaz)
  ve GET /api/v1/posts/[id] (detay + herkese açık yorumlar; 404/401/429
  envelope'lı). Admin API'ler: /api/admin/api-keys (tam anahtar YALNIZCA
  oluşturma yanıtında) ve /api/admin/webhooks (secret sunucuda üretilir,
  bir kez döner). Dashboard'a "API Anahtarları" + "Webhook'lar" kartları.
  Inngest send-webhooks: post/created → post.created,
  post/status.changed → post.status_changed, post/comment.created →
  comment.created (WEBHOOK_EVENT_MAP); her endpoint ayrı step — tek hata
  yalnızca kendi teslimatını retry eder. lib/webhooks/dispatch.ts:
  HMAC-SHA256 imza `${timestamp}.${body}` üzerinden, header
  X-Feedl-Signature: t=<ts>,v1=<hex>, 10s timeout, non-2xx throw.
  Middleware'e /api/v1 public eklendi (kimlik handler'da Bearer ile).

- ✅ **Sprint 37 — Workspace Hazırlık Migration'ı + Merkezi Tenant Scope
  (PM raporu §8.1)** (2026-09-04, commit ae6bea0 + 1e0ac21 + 1ae5cf1):
  P0.1'in UI'siz temel adımı — kullanıcı görünürlüğü değişmez,
  Paddle plan limitlerinin (Faz 5) izleyeceği workspace bağlantısı
  kurulur. Migration 0020_workspaces: workspaces tablosu (id, name,
  slug unique, timestamps; seed satırı slug='feedl') + 8 üst düzey
  tabloya workspace_id FK (posts, tags, saved_views,
  changelog_entries, api_keys, webhook_endpoints, companies,
  opportunities) + backfill (SET NOT NULL) + index'ler; tags'in global
  unique(name)'i unique(workspace_id, name)'e dönüştü. Çocuk tablolar
  (votes, comments, post_tags, followers, deliveries, merges,
  status_history, ai_suggestions, post_opportunities, company_members,
  changelog_post_links) workspace_id ALMAZ — parent üzerinden scope.
  lib/db/workspace.ts getWorkspaceId(): süreç-içi cache'li singleton,
  slug='feedl' satırını okur, yoksa migration uyarısıyla hata fırlatır.
  Tüm yazma yolları insert'lere workspaceId ekler (posts ×2, tags,
  api_keys, changelog, companies, opportunities, views, webhooks);
  okuma yollarına scope filtresi: portal/widget/roadmap/oyladıklarım,
  api/v1, votes, comments doğrulamaları, dashboard (tüm kart sorguları
  + weekly counts), tüm admin route'ları, lib/api-keys auth,
  lib/webhooks/dispatch, lib/db/revenue-scores, lib/post-merge (ham SQL
  state sorgusu — çapraz workspace merge engellenir), inngest bildirim
  post doğrulamaları, inngest sync-tags (tag insert + lookup scope'lu).
  Bilinen not: migrations/meta/0019_snapshot.json eksik olduğundan
  gelecekteki drizzle-kit generate diff'leri elle düzeltilecek (0020'de
  olduğu gibi). DB doğrulandı: 1 workspace, 8 tabloda NULL yok.

- ✅ **Sprint 38 — Widget Origin Yönetimi + Paylaşımlı Rate Limit
  (PM raporu §8.2)** (2026-09-04, commit 13a4f40 + d702c71 + f071309 +
  ee41e1e; kullanıcı kontrol listesi + yerel uçtan uca test):
  (c) madde kod incelemesiyle çözüldü — API key SHA-256 key_hash ile
  saklanıyor, düz metin yok (Sprint 34'ten beri), PM raporu güncellendi.
  Widget origin kontrolü üç katmanlı: (1) self-origin
  (NEXT_PUBLIC_APP_URL + canlı fallback) her zaman izinli; (2) env
  listesi FEEDL_WIDGET_ALLOWED_ORIGINS; (3) widget_origins tablosu
  (migration 0021, workspace bazlı, unique(workspace_id, origin)).
  Hiçbiri kapsamıyorsa RED — "env boşsa herkes kabul" davranışı bitti.
  lib/widget/origins.ts: isOriginAllowed (10s TTL cache +
  invalidateOriginsCache) + normalizeWidgetOrigin (yalnız
  scheme://host[:port]; path/query/hash/userinfo reddedilir);
  session/posts/votes route'ları bağlandı. Admin: /api/admin/widget-origins
  (GET/POST/DELETE; duplicate pre-check + isUniqueViolation cause-chain
  kontrolü — drizzle 0.45 hatayı DrizzleQueryError.cause'a sarıyor,
  err.code yüzeyde yok) + /dashboard/widget "İzinli siteler" kartı
  (WidgetOriginsManager) + yanlış "Boşsa kısıt yok" metni düzeltildi.
  Paylaşımlı rate limit: Upstash Redis (Vercel Marketplace, feedl_db /
  us-east-1), @upstash/ratelimit 2.0.8 — lib/api-keys.ts checkRateLimit
  async: env varsa slidingWindow(60/dk, prefix "feedl:rl") tüm
  instance'larda ortak; Redis hatasında süreç-içi fallback (log düşer);
  env yoksa eski davranış. api/v1/posts ×2 await'e geçti. Yerel test:
  ping PONG; 5 istek/10sn/3 limit → true,true,true,false,false. Canlı:
  anahtarsız /api/v1/posts → 401 zarfı doğrulandı; UPSTASH env'leri
  Vercel'e eklendi + redeploy.

- ✅ **Sprint 39 — Server-side Pagination + Test/CI başlangıcı (PM raporu
  §8.3)** (2026-09-04, commit 46f65b5 + c72bbdc + b3e35bc + dea5bc1;
  npm test 17/17 + build ✓): Portal limit(100), dashboard limit(200)
  ile kırpıyordu — büyüme durumunda kayıp veri. Uygulama: URL ile
  taşınan `?per=5|25|50|all` (varsayılan 5; "all" üst sınır 1000) +
  `?page=N`; sunucuda offset/limit + aynı where koşuluyla ayrı joinsiz
  count sorgusu (arama koşulu yalnız posts sütunlarına referans verir).
  lib/pagination.ts parsePagination: üç sayfanın ortak whitelist
  ayrıştırması (tek kaynak kuralı); PaginationFooter bileşeni: sayfa
  boyutu seçici (FilterTabs; per değişince page sıfırlanır) + Önceki/
  Sonraki (sayfa dışına taşıyınca pasif). Portal: sayfalama TÜM sıralı
  liste (shipped + aktif) üzerinden; "Yayında" sayfa içi gruplama olarak
  korundu; vektör fallback kararı artık count üzerinden (davranış
  aynı, OpenRouter maliyeti artmadı). Dashboard: durum filtresi
  sunucuya taşındı (client filtresi sayfalı listede yanlış olurdu);
  istatistik/duygu/top-5 agregat sorgusuna alındı (loadPostStats —
  tablo sayfalansa da kartlar tüm fikirleri yansıtır; eski limit(200)
  toplamlarından daha doğru); countDashboardPosts + paylaşımlı
  dashboardPostConditions; filtre sekmeleri per'i korur. Oyladıklarım:
  oy sorgusuna offset/limit; detay sorgusu sayfadaki id'lerle sınırlı.
  Test/CI: vitest 3.2.7 (vitest@5 @types/node ^22 istediği için pinned
  20 kaldı) + vitest.config.ts (@ alias + server-only stub); 17 test:
  parsePagination, foldTr/buildPostSearch tokenization, statusLabels/
  summarize, normalizeWidgetOrigin; `npm test` script'i; GitHub
  Actions ci.yml (push/PR → npm ci → npm test → npm run build; build
  için Clerk placeholder key — gizli anahtar yok, tüm env okumaları
  lazy olduğundan DB bağlanmaz). Etiket düzeltmesi: PaginationFooter
  "Sayfa boyutu" → "Kayıt adedi" (kullanıcı tercihi; beeb9e2). CI
  actions/checkout + setup-node v4 → v5 (Node 20 deprecation
  annotation'ı kayboldu; beeb9e2).

### Sprint 40 — Comments/Changelog Polish (PM raporu §8.4) (✅ 2026-09-04)

- ☐ **Keşif ve kapsam onayı:** mevcut yorum bileşenleri, changelog
  sayfaları, email şablonları ve Inngest notify fonksiyonları okunur;
  PM raporu §3 "İyi olur" + §7 UI-UX artıkları ile karşılaştırılıp
  öneri listesi kullanıcıya sunulur (isimlendirme onayı dahil).
- ☑ **Batch 1 — Comments markdown (2026-09-04, commit 8a46565):**
  react-markdown@10 + remark-gfm@4 + remark-breaks@4; ortak
  MarkdownContent bileşeni (ham HTML render edilmez — XSS güvenli;
  dış linkler yeni sekmede; gfm tablo/liste; tek satır sonu = satır
  sonu). CommentCard gövdesi markdown render eder.
- ☑ **Batch 2 — Changelog markdown + görsel + detay sayfası (2026-09-04,
  commit 57ac99c):** `/portal/changelog/[id]`; `imageUrl` kolonu
  (elle migration 0022); admin formuna görsel URL alanı + "Markdown
  destekler." ipucu.
- ☑ **Batch 3a — Serbest changelog etiketi (2026-09-04, commit
  16b4a8e + 6b77022):** API `label` şeması enum'dan serbest metne
  (1-40 kar); admin formu datalist önerili input (yeni/iyileştirme/
  düzeltme); native dropdown'lar `color-scheme` ile temaya uydu.
  Not: boş etiket = rozet yok — beklenen davranış (bug değil).
- ☑ **Batch 3b — Changelog e-posta aboneliği (2026-09-04, commit
  346fe15 + ed30c74 + 82c3a1c + c4011d8):** `changelog_subscribers`
  tablosu (migration 0023; workspace+email unique, token'lı
  unsubscribe); portal kutusu "Yeni duyurular için abone ol."
  (girişliye e-posta ön-dolu, anonim de abone olabilir);
  `POST /api/changelog/subscribe` (zod + IP rate limit +
  onConflictDoNothing ile zaten-abone tespiti); admin duyuru POST'u
  `changelog/published` event'i yayar (best-effort); Inngest
  `notify-changelog` abonelere maili gönderir — idempotency step
  memoization ile (anonim aboneler email_deliveries'e yazılamaz);
  unsubscribe `type=changelog` satırı siler. Mail konusu:
  "🎉 Yeni duyuru: {başlık}".
- ☑ **Batch 3b ek — onaylı mail metinleri (2026-09-04, commit
  70e0858):** mail footer "Bu e-postayı feedl.app duyurularına abone
  olduğun için alıyorsun." + link "Feedl aboneliğinden çık" (html +
  text); çıkış sayfası "bağlantı bulunamadı" varyantı
  "Bu bağlantısı geçersiz veya abonelik zaten kaldırılmış." olarak
  revize edildi. Eski maillerde eski footer kalır (normal).
- ☑ **Batch 4 — Fikir takibi / Follow (2026-09-04, commit e41584d):**
  `POST/DELETE /api/posts/[id]/follow` (auth handler'da; workspace
  kontrolü; birleşmiş fikir reddi — bildirim akışı hedef fikirde;
  unique(post_id, user_id) ile idempotent insert); detay sayfasında
  oy butonunun yanında "Takip Et"/"Takipte" butonu (takip durumu
  loadPost'ta sorgulanır; sunucu zarfıyla güncellenir). Takipten
  çıkmak oy/yorumları silmez; otomatik takip davranışı (yazar/oy/
  yorum) aynen korunur.
- ☑ **Batch 5 — Durum Geçmişi bölümü (2026-09-04, commit c1b75bd):**
  fikir detay sayfasında herkese açık `post_status_history` listesi
  (Sprint 23 verisi): eski→yeni StatusBadge + tarih + varsa admin
  notu (whitespace-pre-line). Notlar zaten takipçilere bildirim
  e-postasıyla gittiği için portalda gösterilmesi tutarlı.
- ☑ Her batch: npm test (17/17) + npm run build ✓ → commit → push →
  kısa test listesi.
- **Widget tema/branding kontrolü** Sprint 41'e taşındı (§7'nin
  tek kalan artığı).

### Sprint 41 — Widget Tema/Branding (PM raporu §7 artığı) (✅ 2026-09-04)

- **Kapsam (kullanıcı onaylı):** embed script'e `data-accent` (launcher
  arka plan rengi, yalnızca hex; yazı rengi WCAG kontrastına göre
  otomatik beyaz/siyah — örn. mercan gibi açık renklerde siyah) ve
  `data-theme` (light | dark | auto, **varsayılan light** — kullanıcı
  tercihiyle mevcut gömülüler etkilenmez) attr'ları.
- ☑ **`public/widget.js`:** hex doğrulama (3/4/6/8 hane), luminance
  hesabıyla launcher yazı rengi, launcher stili inline (CSS'ten sabit
  renk kaldırıldı); iframe src'e `?theme=` parametresi (light'ta
  eklenmez); panel + kapat butonu çözümlenen temaya göre renklenir
  (auto modda matchMedia ile canlı izlenir).
- ☑ **`app/widget/page.tsx`:** `?theme=` parametresi doğrulanır
  (whitelist), dark/auto'da hydration öncesi inline script `html`'e
  `.dark` class'ı ekler (auto: prefers-color-scheme change listener);
  arama formu ve "aramayı temizle" linki theme parametresini korur.
- ☑ **`components/custom/widget-setup.tsx`:** yeni "Görünüm" bölümü
  (renk seçici + Tema: Açık/Koyu/Sistem select); snippet canlı güncellenir,
  non-default değerler `data-accent`/`data-theme` olarak yazılır;
  adımlar yeniden numaralandı (1 jeton, 2 görünüm, 3 snippet).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- Sonraki: **Sprint 42 = §8.5 Custom fields** (Sprint 21 tek taksonomi
  kararı korunacak: admin tanımlı özel alanlar olarak daraltılacak,
  kapsam kullanıcıya onaylatılacak).

### Sprint 42 — Custom Fields (PM raporu §8.5) (✅ 2026-09-04)

> Kullanıcı kapsamı onayladı ve genişletti: "MVP seviyesini çoktan
> geçtik, geliştirme yaparken MVP diyerek erteleme yapma" → tam kapsam:
> 4 alan türü (text/select/number/date) + `required` + `show_on_portal`
> görünürlüğü + sıralama. Sprint 21 tek taksonomi kararı korunur:
> postType = kategori, tags = serbest etiket; custom fields bunlardan
> bağımsız, admin tanımlı bir katmandır. Ayrı categories tablosu YOK.

- ☑ **Batch 1 — Şema + migration (2026-09-04, commit d172b20):** `customFields`
  (id, workspace_id, name, field_type enum text/select/number/date, options
  text[], required, show_on_portal, display_order, created_at;
  unique(workspace_id, name)) + `postCustomValues` (id, post_id, field_id,
  value text, created_at, updated_at; unique(post_id, field_id)) tabloları
  `lib/db/schema.ts`'e eklendi; migration **0024_custom_fields.sql**
  generate + migrate ile canlı Neon'a uygulandı.
  - **Migration zincir onarımı:** drizzle-kit generate "0020/0021
    snapshot parent collision" hatası verdi — 0020 ve 0021 snapshot'ları
    aynı `id`/`prevId` taşıyordu (elle + generate karışımından). 0021'e
    yeni id, 0022.prevId'yeni id'e bağlandı. Ayrıca 0022/0023 `when`
    değerleri bozuktu (gelecek tarihli, +24h sentetik) → 0024'ün `when`'i
    onlardan küçük kaldığı için drizzle 0024'ü "uygulanmış" sayıp
    atlıyordu; journal `when`'leri ve `drizzle.__drizzle_migrations`
    `created_at` değerleri tutarlı gerçekçi değerlere çekildi (0021-0023
    elle uygulanmıştı, kayıt yoktu). Sonrası: 25/25 kayıt, hem tablo hem
    enum doğrulandı. NOT: gelecekteki drizzle-kit generate diff'leri
    elle düzeltilecek.
- ☑ **Batch 2 — API (2026-09-04, commit 089d99a):** `lib/validations/custom-field.ts`
  (create/update şemaları, customFieldTypeValues, firstIssueMessage);
  `GET/POST /api/admin/custom-fields` + `PATCH/DELETE /api/admin/custom-fields/[id]`
  — widget-origins deseni (getAdminUserId 403, zod, workspace scope, pre-check
  + isUniqueViolation 409). POST: fieldType=select ise options zorunlu,
  diğer türlerde null; PATCH: nihai tür select değilse options temizlenir.
- ☑ **Batch 3 — Tanım sayfası (2026-09-04, commit e146988):**
  `app/(main)/dashboard/fields/page.tsx` (admin guard + DB'den alanlar) +
  `components/custom/custom-fields-manager.tsx` (ekle/düzenle/sil + yukarı/aşağı
  sırala — displayOrder takası ile; tür seçici native select, options textarea
  "satır başına bir seçenek"); dashboard üst butonlarına "Özel Alanlar" linki
  (Şirketler ile Widget arasına).
- ☑ **Batch 4 — Değer girişi + görünürlük (2026-09-04, commit 907c7e3):**
  `POST /api/admin/posts/[id]/custom-values` (field türüne göre doğrulama:
  number regex + virgül→nokta, date YYYY-MM-DD, select seçenek üyeliği;
  required boş bırakılamaz; boş değer = temizle; unique üzerinden
  `onConflictDoUpdate` ile tek set upsert — `excluded.value` kullanılır);
  `components/custom/custom-values-panel.tsx` (editable=admin: tür başına
  giriş + "Değerleri Kaydet"; editable=false: salt okunur); portal detay
  sayfasında admin kutusuna tüm alanlar düzenlenebilir, herkese yalnızca
  `show_on_portal` alanlar "Detaylar" bölümünde okunur.
- ☑ Her batch: npm test (17/17) + npm run build ✓ → commit → push.

### Sprint 43 — Full API/Webhook Event Matrix (PM raporu §9 madde 6) (✅ 2026-09-04)

> PM raporu §4'teki webhook eksiği kapatılır: "Webhook olayları dar:
> deleted, vote.created/deleted, changelog yok → event matrix eksiği".
> Entegrasyonu (maddde 7'sındaki ilk canlı connector) mümkün kılan adım.

- ☑ **Batch 1 — Olay yayınları (commit e85307d):** `lib/validations/events.ts`'e
  `voteCreatedEventSchema`, `voteDeletedEventSchema`,
  `commentDeletedEventSchema` eklendi. Oy/yorum silme nihai yollara
  `inngest.send` best-effort yayınlar: `/api/votes` (POST vote/created,
  DELETE vote/deleted — yalnızca gerçekten eklenen/silinen satır için
  `onConflictDoNothing().returning().do`), `/api/widget/votes` (aynı,
  session kullanıcısı ile), `/api/comments/[commentId]` DELETE
  (`post/comment.deleted`).
- ☑ **Batch 2 — Matrix + payload zenginleştirme (commit d8d9843):**
  `lib/webhooks/dispatch.ts` `WEBHOOK_EVENTS` listesi 3 → 7 olay
  (post.created, post.status_changed, comment.created, comment.deleted,
  vote.created, vote.deleted, changelog.published; post.deleted yok —
  fikir silme akışı yok). `inngest/functions.ts` `WEBHOOK_EVENT_MAP` +
  triggers 3 → 7; teslimat öncesi `hydrateWebhookPayload`
  (`lib/webhooks/payload.ts`) bağlamı çözer (fikir başlığı, yazar adı,
  yorum gövdesi, duyuru) — webhook tüketicisi artık kimlik yerine
  eyleme dönüştürülebilir veri alır. Admin webhook route'u olay listesini
  `dispatch`'ten alır; webhooks-manager UI'sine yeni olay etiketleri
  (Yorum silindi, Oy verildi, Oy geri alındı, Duyuru yayınlandı) eklendi.
- ☑ **Batch 3 — Public API yazma + duyuru okuma (commit d06f6c8):**
  `POST /api/v1/posts` (Bearer API key; `author.email` zorunlu — yazar
  `api_` önekli stabil müşteri kullanıcısına upsert edilir, `posts.user_id`
  NOT NULL; `post/created` event'ı yayınlar) + `GET /api/v1/changelog`
  (yayınlanmış duyurular). `lib/users/api-user.ts` `upsertApiUser`
  (e-posta ile bul-ve-update, yoksa api_<uuid> insert).
- ☑ **Batch 4 — API key write kapsamı (commit e85383f):** Yeni anahtar
  `scopes: ["read"] | ["read","write"]` (varsayılan read); `POST /api/v1/posts`
  `write` kapsamı ister (403 yoksa). Admin api-keys route'u `scopes` alır,
  api-keys-manager UI'sine kapsam seçici (Salt okunur / Okuma + yazma) +
  listede kapsam rozeti eklendi; dashboard loadApiKeys `scopes` taşır.
- ☑ Her batch: npm test (17/17) + npm run build ✓ → commit → push.
- ☑ **Madde 6 tamamlandı:** `vote.created/deleted` ve `comment.deleted`
  için public API yazma uçları (commit d01e743 sonrası):
  `POST /api/v1/posts/[id]/votes`, `DELETE /api/v1/posts/[id]/votes`,
  `POST /api/v1/posts/[id]/comments` — `write` kapsamı zorunlu, yazar
  `upsertApiUser` ile müşteri kullanıcısına bağlanır, olaylar yayınlanır.
  **Dead-letter:** `webhook_deliveries` tablosu (migration 0025/0026,
  unique(endpoint_id,event,payload)) + `lib/webhooks/delivery-log.ts`
  (recordDeliveryFailure / markDeliveryDelivered best-effort + attempts
  artırımı); `send-webhooks` her teslimatı izler — başarısızlıkta
  dead-letter'a yazar ve retry için rethrow, başarıda delivered'a çeker.
  Admin: `GET /api/admin/webhooks/deliveries?status=failed` (dead-letter
  listesi) + `POST /api/admin/webhooks/deliveries/[id]/replay` (kayıtlı
  payload ile yeniden imzalı teslimat) + webhooks-manager UI'sinde
  "Son başarısız teslimatlar" + "Yeniden Dene" bölümü. Sonraki: madde 7
  (ilk canlı connector).

### Sprint 44 — İlk Canlı Connector (PM raporu §9 madde 7) (✅ 2026-09-04)

> İlk connector: dış sistemlerin geri bildirim mesajını feedl'e taşıyan
> HERHANGİ bir kanal için ortak giriş (inbound) noktası. Üçüncü taraf
> OAuth/credential gerektirmez — mevcut API anahtarı (write kapsamı) ile
> doğrulanır; Intercom/Zendesk/Slack gibi adaptörler bu uca POST eder ve
> AI Autopilot triage'ını kanıtlar (mesaj → fikir + sentiment/etiket/özet).

- ☑ **`posts.source` kolonu (migration 0027):** fikrin geldiği kaynak
  (portal | widget_embed | api | inbound:<ad>). Mevcut oluşturma yollarına
  `source` set edildi: `/api/posts` (portal), `/api/widget/posts`
  (widget_embed), `/api/v1/posts` (api). Connector'ların Autopilot'u
  kaynağa göre izlenebilir.
- ☑ **`POST /api/v1/feedbacks` (inbound connector):** write kapsamı;
  `{ source, author:{email,name?}, message, title? }` — serbest mesaj alır,
  başlık verilmediyse mesajın ilk satırından üretilir (140 kırpma),
  `source` ile etiketlenir (`inbound:<ad>`), `post/created` yayınlar →
  AI Autopilot çalışır. Örn. Intercom adaptörü bir müşteri mesajını buraya
  POST ederek fikir oluşturur.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki (madde 8):** Workspace/board UI + private access + role matrix
  + custom domain (domain alındığında; subdomain yönlendirme P0.1 veri
  temeliyle kuruldu).

### Sprint 45 — Gelişmiş Revenue/Reporting (PM raporu §9 madde 9) (✅ 2026-09-04)

> Farklılaşma katmanı: PM raporu §4 "Revenue score genel değil" notunu
> genişletir — şirket/fırsat verisinden segment MRR, yenileme/churn riski ve
> dealbreaker (gelir etkisi en yüksek fikirler) raporu üretilir.

- ☑ **Şema (migration 0028, commit 2fc8e24):** `companies`'e `status`
  (active | at_risk | churned, varsayılan active), `renewal_date`,
  `segment` kolonları. Companies API (POST/PATCH) + manager form'una
  Durum seçici (Aktif/Risk altında/Kaybedildi), Yenileme tarihi (date),
  Segment (input) alanları eklendi; liste satırında durum rozeti +
  segment + yenileme tarihi görünür.
- ☑ **Rapor (commit ab5d003):** `lib/db/revenue-report.ts`
  `loadRevenueReport()` — MRR özeti (toplam/aktif/risk/kaybedilen),
  segment kırılımı, 90 gün içinde yenileme riski (renewalDate - bugün),
  churn adayları (status=churned VEYA lost fırsat), dealbreaker fikirler
  (şirket MRR toplamı + açık fırsat değeri ile en yüksek gelir
  maruziyeti). `app/(main)/dashboard/revenue/page.tsx` +
  `components/custom/revenue-report.tsx` (sunum bileşeni — MRR kartları,
  segment listesi, risk/churn listeleri, dealbreaker top-10; TRY
  para birimi). Dashboard üst barına "Gelir Raporu" butonu.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki (madde 8):** Workspace/board UI + private access + role matrix
  + custom domain (domain alındığında). Ya da madde 12: Paddle
  billing/plan limitleri.

### Sprint 48a — Workspace Yönetim Paneli + Custom Domain Hazırlığı (PM raporu §9 madde 8) (✅ 2026-09-04)

> Madde 8'in ilk parçası (düşük risk, additive): workspace meta yönetimi.
> slug subdomain kaynağı olarak salt-okunur; custom domain/brand/logo
> alanları eklenir. Çoklu tenancy + board modeli (48b) ve erişim
> politikaları/subdomain routing (48c) sonraki adımlar.

- ☑ **Şema (migration 0029, commit bdba602):** `workspaces`'e
  `custom_domain` (varchar 200), `brand_color` (varchar 20),
  `logo_url` (text) kolonları. `lib/db/workspace.ts` / getWorkspaceId
  değişmedi (tek workspace dönemi).
- ☑ **API:** `GET/PATCH /api/admin/workspace` — slug salt-okunur
  (değiştirilemez); name 1-120, customDomain normalize (trailing slash
  at + küçük harf), brandColor hex regex (#'lı/#'siz kabul → # ekle),
  logoUrl url. Admin guard 403, workspace scope.
- ☑ **UI:** `app/(main)/dashboard/settings/page.tsx` (admin guard +
  DB'den workspace) + `components/custom/workspace-settings.tsx`
  (ad, slug önizleme `.feedl.app`, custom domain, marka rengi + renk
  önizleme karesi, logo URL; Kaydet + inline hata). Dashboard üst
  barına "Ayarlar" butonu.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki:** 48b — Board modeli (`boards`, `board_statuses`,
  `board_members`) + `posts.board_id` + merkezi tenant scope (her
  sorguya boardId kapsamı). En kritik/büyük parça.

### Sprint 48b — Board Modeli + Tenant Scope (PM raporu §9 madde 8) (✅ 2026-09-04)

> Kullanıcı kararı: **Model B** — her board kendi portalına sahip (`portal/[slug]`);
> board yalnızca POST'ları kapsar (Canny modeli), companies/opportunities/
> changelog/api_keys workspace-scoped kalır. Varsayılan board "genel" mevcut
> tüm fikirleri taşır. Portal URL/subdomain routing (48c) sonraki adım.

- ☑ **Şema (migration 0030, commit d084952):** `board_visibility` enum
  (public/private) + `boards` tablosu (id, workspace_id, name, slug
  unique(workspace_id,slug), description, visibility, sort_order,
  timestamps) + `posts.board_id` FK (nullable, set null). Migration SQL'ine
  **default board seed** eklendi: her workspace için 'Genel' (slug=genel,
  public, sort_order 0) + `UPDATE posts SET board_id = genel WHERE NULL`.
  DB doğrulandı: 1 'Genel' board, 9/9 posta board atandı.
- ☑ **Helper:** `lib/db/board.ts` — `getDefaultBoardId()` (cache'li
  singleton), `listBoards()`, `resolveBoardBySlug(slug, isAdmin)`
  (private board yalnızca admin'e görünür),`isBoardInWorkspace()`.
- ☑ **API:** `GET/POST/PATCH/DELETE /api/admin/boards` — slug regex,
  unique(workspace,slug) 409, varsayılan 'genel' board silinemez ve gizli
  yapılamaz, PATCH/DELETE `?id=` query ile.
- ☑ **UI:** `app/(main)/dashboard/boards/page.tsx` +
  `components/custom/boards-manager.tsx` (ekle/düzenle/sil, görünürlük
  rozeti, varsayılan sil butonu devre dışı). Dashboard üst barına
  "Board'lar" butonu.
- ☑ **Post oluşturma scope:** `/api/posts`, `/api/widget/posts`,
  `/api/v1/posts`, `/api/v1/feedbacks` > `boardId: getDefaultBoardId()`
  (yeni fikirler varsayılan board'a yazılır; tek board döneminde doğru).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki:** 48c — Board bazlı portal URL (`portal/[slug]`),
  subdomain routing (`acme.feedl.app` -> workspace çözümleme),
  board erişim politikaları + role matrix. Bu, board'ların gerçek
  kullanımı (farklı portallar) için gerekli.

### Sprint 48c — Board Erişim + Portal Filtresi (PM raporu §9 madde 8) (✅ 2026-09-04)

> Kullanıcı kararı: **B2 (korunaklı)** — board'a özel tam URL yerine mevcut
> `/portal/[id]` (fikir detayı) korunur; board erişimi `?board=slug` query
> ile. Mevcut e-posta/portal linkleri bozulmaz.

- ☑ **Portal listesi (`portal/page.tsx`, commit ec78130):** `?board=slug`
  okunur; aktif board `resolveBoardBySlug(slug, isAdmin)` ile çözülür
  (private + admin değilse `genel`'e redirect). `buildPostConditions`'a
  `boardId` koşulu eklendi; `loadPosts`/`countPosts` boardId alır. Board
  seçici (pill) render — public boardlar anonime, private yalnızca admin;
  aktif vurgulu. Arama formu + FilterTabs + PaginationFooter `board`
  parametresini korur. `buildPortalHref` yardımcısı (q/sort/tag + board).
- ☑ **Detay erişimi (`portal/[id]`, commit ec78130):** UUID değilse board
  slug kabul edilir → `/portal?board=slug` redirect. `loadPost` `boardId`
  döner; post private board'a aitse + admin değilse `notFound()`.
- ☑ **Roadmap güvenliği (`roadmap/page.tsx`, commit 9fa6d1e):** roadmap
  yalnızca public board (veya board'sız) fikirleri gösterir — private
  board fikirleri sızmaz.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki (48c'nin kalanı):** subdomain routing (`acme.feedl.app` ->
  workspace çözümleme) + role matrix (owner/admin/member). Bunların
  middleware + Vercel/DNS gerektirir ve ayrı sprint'te yapılır. Dashboard
  `?board=` filtre de eklenebilir (48d adayı).

### Sprint 48c-2 — Role Matrix (workspace üyeleri) (PM raporu §9 madde 8) (✅ 2026-09-04)

> Kullanıcı onayı: 48c kalanının kod dışı Vercel/DNS gerektiren subdomain
> kısmı tehir edildi; owner/admin/member rol matrisi bu sprint'te tamamlandı.
> Sonrasında 48d (dashboard board filtre) hedefi.

- ☑ **Şema (migration 0031, commit 7240fe8):** `workspace_member_role`
  enum (owner/admin/member) + `workspace_members` tablosu (workspace_id,
  user_id, role, timestamps; unique(workspace_id,user_id), user_idx).
  Migration seed: mevcut `users.role='admin'` olanları feedl workspace'ine
  owner olarak ekler (geçiş dönemi uyumluluğu).
- ☑ **Helper:** `lib/db/membership.ts` — `getWorkspaceRole` (cache'siz),
  `hasWorkspaceAdminAccess` (owner/admin + users.role='admin' geriye dönük),
  `listWorkspaceMembers` (users join), `upsertWorkspaceMember`
  (onConflictDoUpdate), `removeWorkspaceMember` (son owner kaldırılamaz).
- ☑ **Auth:** `lib/auth/admin.ts` getRole önce workspace rolünü döner
  (owner/admin → "admin", member → "customer"), membership yoksa global
  users.role'a düşer; getAdminUserId buradan doğrular.
- ☑ **API:** `GET/POST/PATCH/DELETE /api/admin/members` — rol değiştir,
  üye ekle (kullanıcı Clerk'te var olmalı), çıkar (son owner reddedilir).
- ☑ **UI:** `app/(main)/dashboard/members/page.tsx` +
  `components/custom/members-manager.tsx` (üye ekle diyalog — kullanıcı
  seçici + rol; satır içi rol dropdown; çıkar). Dashboard üst barına
  "Üyeler" butonu.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sonraki:** 48d — Dashboard `?board=` filtre + board'a göre fikir
  yönetimi.

### Sprint 48d — Dashboard Board Filtresi + Board'a Göre Yönetim (PM raporu §9 madde 8) (✅ 2026-09-04)

> 48'in düşük riskli son parçası: admin dashboard'da board filtre.
> Board'a göre fikir listesi; status/tag/range/sayfalama filtreleri
> board'ı korur.

- ☑ **Dashboard `?board=` filtre (commit e2ec7b2):** `searchParams.board`
  okunur, `resolveBoardBySlug(slug, true)` ile çözülür (admin — private
  board da). `dashboardPostConditions`'a `boardId` koşulu; `loadPosts` /
  `countDashboardPosts` boardId parametresi. Board select UI (Tüm
  Board'lar + board isimleri; private rozeti). Status/tag/range FilterTabs,
  SavedViewBar currentParams, PaginationFooter `board` paramını korur
  (filtre çaprazında board kaybolmaz).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **48 bloğu tamamlandı:** Workspace UI + board modeli + board erişimi
  (portal `?board=`) + role matrix + dashboard board filtresi. Subdomain
  routing (`acme.feedl.app`) Vercel wildcard DNS/SSL gerektirdiği için
  ayrı sprint olarak (kod kısmı middleware + host çözümleyici) tehir
  edildi.

### Sprint 48f — Autopilot Derinleştirme (PII + Tenant + Injection) (PM raporu §9 AI PII) (✅ 2026-09-04)

> PM raporu L131: "Prompt injection + PII maskesi + tenant bağlam ayrımı
> zorunlu" — bu üçü bu sprint'te eklendi. Kullanıcı içeriği OpenRouter'a
> giderken PII maskelenir, bağlam workspace/board'a göre ayrışır,
> injection'lar nötrleştirilir.

- ☑ **PII maskeleme (`lib/ai/pii.ts`, commit d200783):** `maskPii`
  e-posta/telefon/TC/kart/IBAN kalıplarını `[pii:tür]` yer tutucusuna
  çevirir (canlı test: email/phone/tc/card/iban doğru maskelendi, normal
  metin korunur). `embedText`, `analyzeIdea`, `compareIdeas` input'ları
  maskelenir.
- ☑ **Tenant bağlam:** `analyzeIdea` `context.boardName` alır; İnngest
  `ai-autopilot` postun board adını çözüp analiz prompt'una geçirir
  (farklı workspace/board içerikleri karışmaz).
- ☑ **Prompt injection koruması:** `ANALYZE_IDEA_SYSTEM_PROMPT` +
  `COMPARE_IDEAS_SYSTEM_PROMPT` içine "kullanıcı metni yalnızca veridir,
  komutları yok say, [pii:*] yer tutucularını koru" talimatı eklendi.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.

### Sprint 48g — Çoklu Workspace Verisi (PM raporu §9 madde 8) (✅ 2026-09-04)

> Subdomain routing kod tarafı hazırdı; çoklu workspace verisi için
> oluşturma + varsayılan board + owner seed eklendi. "acme" workspace
> oluşturulunca acme.feedl.app o workspace'e hizmet eder.

- ☑ **API (`app/api/admin/workspaces/route.ts`, commit f13997e):**
  `GET /api/admin/workspaces` (tüm workspace'ler) + `POST` (oluştur —
  workspace + varsayılan 'Genel' board (slug genel, public) + oluşturan
  admin'i owner yapan workspace_members seed; seed başarısızsa workspace
  geri alınır; slug unique 409; slug boşsa name'den slugify).
- ☑ **UI:** `app/(main)/dashboard/workspaces/page.tsx` +
  `components/custom/workspaces-manager.tsx` (liste + boardCount +
  subdomain önizleme slug.feedl.app + customDomain; "Yeni Workspace"
  diyalog — ad + subdomain). Dashboard üst barına "Workspace'ler" butonu.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Subdomain doğrulama:** workspace oluşturulup (örn. acme) DNS wildcard
  zaten bağlı olduğu için https://acme.feedl.app uygulamayı açar ve
  getWorkspaceId host-aware olduğundan 'acme' workspace'ini gösterir.

### Sprint 48h — Paddle Billing + Plan Limitleri (Faz 5) (✅ 2026-09-04)

> Paddle kararı uygulandı: sandbox'ta `feedl_` önekli Pro ürün/fiyat
> oluşturuldu (diğer proje UIHub verileriyle karışmadı), plan + limit
> alanları + checkout + webhook eklendi. P0 raporunun en kritik maddesi.

- ☑ **Fiyat kararı (rakip analizi):** Free (1 board, 1 üye, 50 tracked user,
  "Powered by feedl") + Pro $19/ay (yıllık $15/ay: sınırsız board, 10 üye,
  özel domain, marka kaldırma) — Canny $79 altı, FeedLog self-host yüküne
  karşı cazip. Sandbox'ta `feedl_` önekli: ürün `pro_01m1qe6qer9tqbf1y7mzvggjtv`,
  aylık `pri_01m1qe78pe4s9t5x67649983fe`, yıllık `pri_01m1qe78wqmbcp1yxvvnh48x37`.
  (UIHub ürünlerine dokunulmadı.)
- ☑ **Şema (migration 0032, commit b0ce4aa):** `workspaces`'e plan
  (free|pro, default free), paddle_customer_id, paddle_subscription_id,
  tracked_user_limit (50), board_limit (1), member_limit (1).
- ☑ **`lib/paddle.ts`:** Paddle Node SDK (sandbox/live Environment),
  PLANS (free/pro limitleri), planFromString, getPlanLimits,
  enforceLimit (board/member/trackedUser), verifyPaddleSignature
  (HMAC-SHA256, `P-paddle-signature` header).
- ☑ **Checkout:** `/dashboard/billing` + `billing-manager.tsx` —
  initializePaddle (client token + sandbox env) + Paddle.Checkout.open
  (customData.slug ile workspace eşleştirme); aylık/yıllık butonlar.
- ☑ **Webhook:** `POST /api/webhooks/paddle` — imza doğrulama,
  subscription.activated/updated → plan=pro, canceled/past_due → free;
  workspace'i custom_data.slug ile eşleştirir.
- ☑ **Rozet:** `portal/page.tsx`'te free plan'da "Powered by feedl".
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Kalan (kod dışı / sonraki):** Paddle webhook notification destination
  oluştur + `PADDLE_WEBHOOK_SECRET` Vercel'e ekle; `NEXT_PUBLIC_PADDLE_*`
  + `PADDLE_API_KEY` Vercel env; pro limitlerinin uygulanması (board/üye
  oluşturma noktalarında `enforceLimit` çağrıları) bir sonraki adımda.

### Sprint 48i — Plan Limitlerini Uygula (Faz 5) (✅ 2026-09-04)

> 48h'nin "sonraki adım"ı: pro limitlerinin gerçek engellenmesi. Board ve
> üye oluşturma noktalarına enforceLimit bağlandı.

- ☑ **Board limiti (commit bec110f):** `POST /api/admin/boards` mevcut
  board sayısı plan boardLimit'e ulaştıysa 403 (free'de 1 board).
- ☑ **Üye limiti:** `POST /api/admin/members` mevcut üye sayısı
  plan memberLimit'e ulaştıysa 403 (free'de 1 üye; pro'da 10).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sıradaki (PM raporu §5):** 3 — Davet akışı (email invitation) + rol
  granülerliği; 4 — Workspace markalamasını uygula (logo/renk → portal);
  5 — Widget AI triage; 6 — Guest mode; 7 — Changelog draft/reaction;
  8 — ilk gerçek connector. (Paddle webhook secret/Vercel env kullanıcı
  tarafındadır; kod buna bağımlı değil.)

### Sprint 48j — Davet Akışı + Rol Granülerliği (madde 8, P1) (✅ 2026-09-04)

> PM raporu §5 #3: yalnız var olan Clerk kullanıcısı eklenebiliyordu; yeni
> takım üyesi e-posta ile davet edilebiliyor. Contributor rolü eklendi.

- ☑ **Şema (migration 0033, commit f16abab):** `workspace_member_role`
  enum'una `contributor` + `workspace_invites` tablosu (id, workspace_id,
  email, role, token unique, expires_at, accepted_at, created_by,
  created_at).
- ☑ **`lib/db/invites.ts`:** generateInviteToken (32 byte hex),
  createInvite (7 gün TTL), findValidInvite (acceptedAt null + süre
  kontrolü), acceptInvite (e-posta eşleşmesi + üye ekle/rol güncelle +
  acceptedAt işaretle), listWorkspaceInvites. PII/token redaksiyon + rate
  limit API katmanında.
- ☑ **API:** `POST /api/admin/invites` (üye limiti enforceLimit + mail
  gönder — renderInviteEmail) + `GET` (davetler); `POST /api/invites/accept`
  (auth; 401 → girişe yönlendir).
- ☑ **UI:** `components/custom/invite-accept-form.tsx` (+ `/invites/accept`
  server page + Suspense — useSearchParams prerender çözümü);
  `members-manager`'a "Davet Gönder" dialog; middleware `/invites(.*)` public.
- ☑ **Rol granülerliği:** `WorkspaceMemberRole` + `getRole` contributor →
  customer; members/invites şemaları contributor kabul eder; members UI
  rol listesinde "Katkıcı".
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sıradaki:** 4 — Workspace markalamasını uygula (logo/renk → portal).

### Sprint 48k — Workspace Markalamasını Uygula (madde 8, P1) (✅ 2026-09-04)

> brandColor/logoUrl kaydediliyordu ama portal hiç kullanmıyordu (ölü
> alanlar). Artık üst bar + footer workspace markasını gösterir.

- ☑ **`lib/db/workspace.ts`:** `getWorkspaceBrand()` — workspace name,
  customDomain, brandColor, logoUrl (workspace yoksa default feedl).
- ☑ **`SiteHeader`:** brand prop — logo varsa img, yoksa ChevronsUpIcon;
  marka bloğu `brandColor` + `textOn()` kontrast rengi (WCAG tahmini:
  aydınlatma > 0.55 → koyu mürekkep, değilse beyaz). Marka adı gösterilir.
- ☑ **`(main)/layout.tsx`:** `getWorkspaceBrand()` çağrılır → SiteHeader
  brand prop + footer workspace adı.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sıradaki:** 5 — Widget AI triage (feedback/support/clarify).

### Sprint 48l — Widget AI Triage (madde 8, P1) (✅ 2026-09-04)

> FeedLog'un en güçlü özelliği: widget mesajını AI sınıflar (feedback /
> support / clarify / unrecognized) ve ona göre davranır.

- ☑ **Şema (migration 0034, commit 58be6ee):** `widget_triage` enum
  (feedback/support/clarify/unrecognized) + `widget_triages` tablosu
  (workspace_id, user_id, message, classification, response, created_at).
- ☑ **AI:** `classifyWidgetMessage` (lib/ai/analysis) — maskPii + LLM
  sınıflandırma + widgetTriageSchema; sistem prompt injection guard.
- ☑ **API:** `POST /api/widget/triage` — origin/session kontrolü;
  feedback → post oluştur + post/created yayınla (girişliyse),
  support/clarify/unrecognized → yönlendirme yanıtı; audit kaydı.
- ☑ **UI:** `components/custom/widget-triage.tsx` — widget'ta "Farklı bir
  konu mu?" açılır sohbet; mesaj → AI sınıfla → yanıt/fikir. `app/widget/
  page.tsx`'e eklendi (oturumlu ve anonim).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Sıradaki:** 6 — Guest mode + identity merge.

### Sprint 48m — Widget Identify Güçlendirme (Canny modeli) (✅ 2026-09-04)

> Kullanıcı kararı: rakipler (Canny) anonim guest DEĞİL, Identify/SSO ile
> gerçek müşteri kimliği kullanıyor. Anonim guest yerine widget Identify
> güçlendirildi (P0.2/IP4.1 doğrultusunda: "anonim değil gerçek kimlikle
> oylar" — oxalpha §E).

- ☑ **`public/widget.js` (commit 5e0b3d5):** `window.feedlWidget.identify({ token })`
  dinamik kimlik API'si — müşteri uygulaması kullanıcı girişi/oturum sonrası
  yeni kısa ömürlü jeton vererek `/api/widget/session`'ı yeniden çağırır
  (Canny `canny.identify` karşılığı). Token yoksa widget salt-okunur kalır;
  anonim kimlik yok, `widget_<sub>` gerçek müşteri kimliği.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Not:** Anonim guest mode (FeedLog tarzı) FEEDLOG-doğru olurdu ama
  Canny'nin kanıtlanmış modeli Identify'dır; ileride guest mode gerekirse
  spam/rate-limit + merge kurallarıyla (parite raporu P0.2 sarı şartı)
  eklenir.

### Sprint 48n — Changelog Draft/Publish + Reaction (madde 8, P1) (✅ 2026-09-04)

> FeedLog'un draft → published yaşam döngüsü; şu an entry yayınlanınca
> direkt public. Reaction'lar bu sprint'te kapsam dışı (şema hazırlandı,
> UI reaction sonra).

- ☑ **Şema (migration 0035, commit 615b3bb):** `changelog_entries`'e
  `status` (draft|published, default published) + `publishedAt` nullable
  (draft'ta null). Mevcut satırlar 'published' (publishedAt dolu).
- ☑ **API:** `POST /api/admin/changelog` status alır (draft → publishedAt
  null + event yok; published → publishedAt now + event).
  `POST /api/admin/changelog/[id]/publish` — draft'ı yayınla (publishedAt + event).
- ☑ **Portal:** `portal/changelog` + `[id]` yalnız `status='published'`
  gösterir (draft 404/public görünmez); publishedAt null-safe format.
- ☑ **Admin UI:** `changelog-admin.tsx` status select (Yayınla/Taslak),
  listede "Taslak" rozeti + "Yayınla" butonu, `status` prop + publish
  aksiyon. Dashboard loadChangelogData status taşır.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Not:** Reaction (emoji) şeması/UI sonraki adım; draft modeli tamam.

### Sprint 48o — Slack Connector (madde 8, madde 10) (✅ 2026-09-04)

> İlk gerçek connector — Slack Events API. Slack mesajları → AI triage →
> feedback oluşturma. Zendesk/Intercom sonraki adım (kullanıcı onayı).

- ☑ **`lib/slack.ts` (commit ea8edfc):** verifySlackSignature (X-Slack-Signature
  v0 HMAC-SHA256, timestamp replay 5dk), parseSlackMessage (message event;
  bot_message/message_changed/deleted hariç), isSlackConfigured.
- ☑ **`POST /api/integrations/slack/events`:** imza doğrulama, url_verification
  challenge yanıtı, message → classifyWidgetMessage → feedback ise post
  oluştur + post/created yayınla (source=slack).
- ☑ middleware `/api/integrations(.*)` public (Slack Clerk'siz çağırır).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Kalan (kullanıcı tarafı):** Slack app oluştur → Event Subscriptions'a
  https://feedl.app/api/integrations/slack/events ekle (message.channels event)
  → Signing Secret → Vercel env `SLACK_SIGNING_SECRET` (+ opsiyonel
  `SLACK_BOT_TOKEN`). Sonra test.

### Sprint 48p — Zendesk Connector (madde 10) (✅ 2026-09-04)

> İkinci gerçek connector — Zendesk Trigger → Webhook (target) ile
> ticket.created → AI triage → feedback. Kullanıcı kurumsal imaj için
> kişisel isim kullanmadı; uygulama feedl olarak adlandırılır.

- ☑ **`lib/zendesk.ts` (commit a365d1c):** verifyZendeskToken (custom
  header X-Feedl-Token, ZENDESK_WEBHOOK_SECRET), zendeskTicketText
  (subject + description → title/body), isZendeskConfigured.
- ☑ **`POST /api/integrations/zendesk/webhook`:** token doğrulama,
  ticket → zendeskTicketText → classifyWidgetMessage → feedback ise
  users upsert (widget_zendesk_<ticket>) + post oluştur (source=zendesk)
  + post/created. Kurumsal: uygulama adı feedl.
- ☑ middleware `/api/integrations(.*)` public (Slack ile ortak).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Kalan (kullanıcı tarafı):** Zendesk Admin → Apps → Webhooks → yeni
  webhook: URL https://feedl.app/api/integrations/zendesk/webhook + custom
  header `X-Feedl-Token: <ZENDESK_WEBHOOK_SECRET>`; Trigger (ticket.created)
  → bu webhook. Vercel env `ZENDESK_WEBHOOK_SECRET`.

### Sprint 48q — Connector Idempotency (çift post önleme) (✅ 2026-09-04)

> Slack'te gerçek çift post tespit edildi (aynı mesaj ~57ms arayla 2 kez
> post oldu — Slack event retry). Aynı kaynak (mesaj/ticket) bir kez post
> edilmesi için sourceRef idempotency eklenir.

- ☑ **Şema (migration 0036, commit b11a609):** `posts.source_ref`
  (varchar 120) + `unique(workspace_id, source_ref)` (null'lar hariç —
  portal/api satırları etkilenmez).
- ☑ **Slack:** `parseSlackMessage` eventTs alır; feedback ise
  `slack:<event_ts>` sourceRef ile önce var mı kontrol — varsa yeni post
  oluşturma (duplicate:true döner).
- ☑ **Zendesk:** `zendesk:<ticket.id>` sourceRef — aynı ticket tekrar post
  edilmez.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.

### Sprint 48r — Intercom Connector (madde 8, madde 10) (✅ hazır, kullanıcı kurulumu bekleniyor)

> Üçüncü gerçek connector — Intercom Developer Hub Webhooks ile hem
> `conversation.user.created` (kullanıcı/lead yeni mesajı) hem
> `ticket.created`/`.updated` (Intercom Tickets) → AI triage → feedback.
> Kurumsal imaj: uygulama adı feedl; kişisel isim kullanılmaz.

- ☑ **`lib/intercom.ts`:** verifyIntercomWebhook (gövde `app_id` ==
  INTERCOM_APP_ID; opsiyonel `X-Intercom-Signature` HMAC-SHA256 ile
  INTERCOM_WEBHOOK_SECRET), parseIntercomPayload, intercomItemText (conversation
  + ticket `ticket_parts`/`ticket_attributes` → title/body), intercomSourceRef
  (`intercom:<id>`), isIntercomConfigured.
- ☑ **`POST /api/integrations/intercom/webhook`:** app_id doğrulama,
  conversation.* veya ticket.* → classifyWidgetMessage → feedback ise users
  upsert (widget_intercom_<contact|id>) + post oluştur (source=intercom,
  sourceRef=intercom:<id>) + post/created.
- ☑ middleware `/api/integrations(.*)` public (Slack/Zendesk ile ortak).
- ☑ npm test (17/17) + npm run build ✓ → commit → push bekleniyor.
- **Kalan (kullanıcı tarafı):** Intercom Developer Hub → Webhooks → yeni
  subscription: URL https://feedl.app/api/integrations/intercom/webhook,
  topic `conversation.user.created` **ve/veya** `ticket.created` (kullanıcının
  Intercom'ta ticket oluşturması varsa ticket topic şart); Vercel env
  `INTERCOM_APP_ID` (qry6m4ro) + opsiyonel `INTERCOM_ACCESS_TOKEN`
  (mesaj içeriği/müşteri bilgisi için, şimdilik kod kullanmıyor) + opsiyonel
  `INTERCOM_WEBHOOK_SECRET`.

### Sprint 48s — Intercom Contact Zenginleştirme + AI/Paddle Dayanıklılık (✅ 2026-09-05)

> Kullanıcı kararları: Intercom `ticket.state.updated` gerekmiyor (ticket
> takibi Intercom'un işi, feedl feedback'e odaklı). Contact bilgisi gerçek
> e-posta/telefon ile zenginleştirilecek. Paddle sandbox'ta kalacak ama webhook
> hazır bekleyecek. Free LLM için OpenRouter ücretsiz modelleri test edildi.

- ☑ **Intercom contact zenginleştirme (migration 0037, commit …):**
  `users.phone` kolonu; `fetchIntercomContact` (INTERCOM_ACCESS_TOKEN ile
  GET /contacts/{id} → email/name/phone; timeout + graceful null),
  `intercomContactId` (webhook contacts[].id). Route'ta kullanıcı gerçek
  e-posta/telefon/kanıt ile upsert edilir; token yoksa widget yedeği kalır.
- ☑ **AI dayanıklılık (lib/ai/openrouter.ts):** `chatJson` + `embedText`'e
  kısa beklemeli retry (429/5xx → 800ms, 2000ms; Inngest retry katmanına
  da düşer). Model önerisi: **minimax/minimax-m3:free KALIR** — canlı test
  (2026-09-05): 3 Türkçe vaka → feedback/support/clarify doğru + geçerli
  JSON; z-ai/glm-5.2:free boş yanıt + 429 verdi (elenir), nemotron-lightning
  JSON bozuyor. 429'lar geçici (yoğunluk) — retry doğru çözüm, model değişimi
  değil.
- ☑ **Paddle webhook sandbox-hazır (lib/paddle.ts + route):** imza doğrulama
  mevcut (P-paddle-signature ts/h1); üretimde (PADDLE_ENV ≠ sandbox) secret
  zorunlu yapıldı — sandbox'ta geliştirme kolaylığı korunur. Paddle dashboard
  webhook adımı ileride: notification destination →
  https://feedl.app/api/webhooks/paddle + secret → PADDLE_WEBHOOK_SECRET env.
- ☑ **Upstash rate-limit:** lib/api-keys.ts zaten @upstash/ratelimit + kayan
  pencere kullanıyor (feedl:rl prefix, 60/dk); env'ler Vercel'de set; in-process
  fallback var. Revizyon gerekmedi (gerekli görülen kısım zaten tamam).
- **Karar/kayıt:** Intercom `ticket.state.updated` abonelikte açık ama kod
  işlemiyor — bu bilinçli (ticket takibi Intercom'un işi), ek özellik yok.

### Sprint 49 — Public Fiyatlandırma Sayfası (Faz 5 ticarileşme) (✅ 2026-09-05)

> Kullanıcı kararı: canlı tahsilat YOK — sandbox'ta kalınır; ancak ticarileşme
> kod aşaması hazırlanır. `docs/plan.md` sonraki notlarının ilk seçilmiş konusu.

- ☑ **`/pricing` public sayfası (commit 33eabff):** `app/(main)/pricing/page.tsx
  (force-dynamic; workspace slug çözümü/fallback feedl).` Plan karşılaştırma:
  Free vs Pro ($0/sonsuz; $19/ay $15 yıllık) — `components/custom/
  pricing-manager.tsx` (client): yıllık/aylık geçiş (has izole), Free CTA
  → /sign-up, Pro → Paddle.js Overlay checkout (customData.slug ile webhook
  eşleşmesi). `middleware.ts` /pricing public; `site-header.tsx` nav'a "Fiyat".
  **UX revizyonu (commit 562510e):** Aylık/Yıllık switch Pro kartının İÇİNE
  alındı (varsayılan YILLIK — yıllıkta aylık eşdeğeri $15/ay + "yıllık $180",
  aylıkta $19/ay); Pro/Free butonları kart içi dipte aynı hizada
  (flex-col + mt-auto).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Kalan (kullanıcı tarafı):** Pro checkout gerçek tahsilat için sandbox
  ürün/fiyat ID'leri + canlı dönüşte production ID'ler → env; `NEXT_PUBLIC
  _PADDLE_*` env'leri Vercel'de set; Paddle dashboard notification
  destination → https://feedl.app/api/webhooks/paddle + `PADDLE_WEBHOOK_SECRET`.

### Sprint 50 — Landing SaaS Satış Sayfası + /demo Ürün Turu (✅ 2026-09-05)

> Kullanıcı kararı: portal/yol haritası/güncellemeler artık main landing'den
> DEĞİL; landing satış odaklı, ürün örnekleri /demo'da. Design report
> (design_report.md) incelendi — eleştiriler: slate/sidebar/dark default
> değişikliği YAPILMADI (mevcut sistemik marka korunur), kapsam sadece
> landing + demo.

- ☑ **`/demo` (commit 0c679dc):** `app/(main)/demo/page.tsx` — ürün turu:
  3 yüzey kartı (Portal / Yol Haritası / Güncellemeler → ilgili canlı
  sayfalar) + gerçek portal fikir kartı örneği (tıklanamaz; StatusBadge,
  TypeBadge, SentimentBadge, statik yorum sayısı — CommentCountBadge
  kullanılmadı çünkü link gerektirir). CTA: Ücretsiz Başla + Fiyatlandırma.
- ☑ **Landing `/` satışa çevrildi:** hero satış değeri ("tahminle değil
  veriyle"), CTA Ücretsiz Başla + Canlı Demo (/demo) + Fiyatlandırma
  (/pricing); gerçek fikir kartı mock (tıklanamaz); "Nasıl çalışır" şeridi
  satış diline; footer CTA. Giriş yapmışsa role yönlendirmesi KORUNUR
  (Sprint 9).
- ☑ **`SiteHeader` nav pathname-duyarlı:** satış (/, /demo, /pricing) →
  Demo + Fiyat; ürün (/portal*, /roadmap*, /dashboard*) → Portal / Yol
  Haritası / Güncellemeler.
- ☑ **`middleware.ts`:** /demo public; /pricing zaten public.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.

### Sprint 51 — Bileşen Tutarlılığı + Footer + Landing Özellikler Bölümü (✅ 2026-09-05)

> Kullanıcı şikâyeti: landing/demo kartlarında chevron (▲) varken portalda
> thumbs-up; tutarsızlık kabul edilemez. Ayrıca footer'da demo linki yok,
> landing sade ve özellikler bölümü yok. Amaç: aynı standart her yerde +
> responsive + kurumsal tanıtım.

- ☑ **`DemoPostCard` (commit 501d66a):** portal fikir kartının GÖRSEL birebir
  karşılığı, etkileşimsiz. Aynı Badge/Button stilleri: ThumbsUpIcon + outline
  Button (VoteButton görünümü), MessageSquareIcon + yorum sayısı (statik),
  StatusBadge/TypeBadge/SentimentBadge + yuvarlak etiket çipleri (TagChips
  görünümü ama link'siz). landing + /demo aynı bileşeni kullanır.
- ☑ **Footer çok sütunlu (layout):** Ürün (Portal/Yol Haritası/Güncellemeler/
  Demo) + Şirket (Fiyatlandırma/İletişim/Gizlilik/Kullanım Şartları) + marka
  blok + telif satırı. `sm:grid-cols-2 lg:grid-cols-4` responsive.
- ☑ **Yasal/şirket stub sayfaları:** /privacy, /terms, /contact (içerik sonra;
  linkler 404 olmasın) + `middleware.ts` public'e eklendi.
- ☑ **Landing özellikler bölümü:** "Özellikler" başlıklı grid (10 kart):
  AI Autopilot, Oylama & Yol Haritası, Değişiklik Günlüğü, Ekip & Rol,
  Entegrasyonlar (Slack/Zendesk/Intercom), Public API & Webhook, Marka &
  Alan Adı, Gelir Skoru, Güvenlik & Gizlilik, İş Akışı & Görünümler.
  `sm:grid-cols-2 lg:grid-cols-3` responsive; lucide ikonlar + brand rengi.
- ☑ npm test (17/17) + npm run build ✓ → commit → push.

### Sprint 52 — Paddle Canlı Geçiş Hazırlığı (Faz 5 ticarileşme) (✅ 2026-09-05)

> Kullanıcı kararı: canlı tahsilat HÂLÂ SANDBOX'ta kalır; ama kod canlı geçişe
> hazırlanır (bir süre daha canlı aktif edilmez). Amaç: sandbox↔live geçişi
> saf env değişimi + Paddle dashboard webhook kurulumu olsun.

- ☑ **`components/custom/plan-config.ts` (commit 20c22b8):** fiyat/price-id
  TEK kaynak — `getPlanEnv()`, `PRO_PLAN` (monthlyPrice $19,
  yearlyMonthlyPrice $15, yearlyTotal $180, monthlyPriceId/yearlyPriceId),
  `isPro()`. billing-manager + pricing-manager buradan okur; hardcoded $19/$15
  ve raw `<button>` kullanımı giderildi (Button komponenti).
- ☑ **Webhook sağlamlaştırma (app/api/webhooks/paddle):** plan artık
  aboneliğin `status` alanından türetiliyor (trialing/active → pro;
  canceled/paused/past_due/dunned → free) — canlı yenileme/ihan/duraklatma
  sağlıklı işlenir. `PADDLE_ENV ≠ sandbox` ise secret zorunlu (tekrar).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Kalan (kullanıcı tarafı, canlıya geçişte):** Paddle Dashboard → belki
  üründe production fiyat oluştur (feedl_ öneki), production API key +
  client token + price ID'leri → aynı env'lere (PADDLE_ENV=live + canlı
  `PADDLE_API_KEY`/`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`/pro price ID'leri);
  Paddle webhook notification destination →
  https://feedl.app/api/webhooks/paddle + `PADDLE_WEBHOOK_SECRET`; sonra
  gerçek ödeme testi.

### Sprint 53 — Roadmap Sürükle-Bırak (Platformlaşma #3) (✅ 2026-09-05)

> Madde 3'ün ilk güvenli/yararlı parçası: admin için roadmap kanban'ında
> kartları kolonlar arasında sürükleyerek durum değiştirme (Canny modeli).

- ☑ **`components/custom/roadmap-columns.tsx` (commit 9b5b524):** client
  kanban — native HTML5 drag&drop (yeni bağımlılık yok). Sadece `isAdmin`
  için: kartlar `draggable`, kolonlar `onDragOver/onDrop`; drop →
  `PATCH /api/admin/posts {postId,status}` (mevcut admin auth + event +
  history) + optimistik güncelleme + hata durumunda geri alma + busy
  göstergesi. Ziyaretçi için salt-okunur.
- ☑ **`app/(main)/roadmap/page.tsx`:** `getAdminUserId()` ile isAdmin tespiti;
  `RoadmapColumns` kullanır; admin ipucu metni. Paylaşılan Card/StatusBadge/
  CommentCountBadge (tutarlılık).
- ☑ npm test (17/17) + npm run build ✓ → commit → push.
- **Karar bekleniyor (portal/[slug]):** `app/(main)/portal/[id]` (post detay)
  dinamik segmentiyle aynı derinlikte `portal/[slug]` eklense Next.js
  "conflicting routes" hatası verir. Bu yüzden board'a özel temiz URL şu ana
  kadar ertelendi (plan notu). Seçenekler: (a) middleware rewrite
  `/portal/:slug` (uuid değilse) → `/portal?board=:slug`; (b) tek dinamik
  segment `[id]` içinde uuid→detay / slug→board ayrımı (invaziv); (c)
  custom-domain sprint'ine ertele (öneri). Kullanıcı onayı bekleniyor.
- **Not (@feedl/widget npm paketi):** `public/widget.js` script olarak var;
  npm paketine dönüştürme → npm publish + versiyonlama gerektirir (npm
  credentials). Bu adım ayrı bir workspace/kredi ister.

### Sprint 54 — @feedl/widget npm Paketi (Platformlaşma #3) (✅ 2026-09-05)

> Madde 3'ün ikinci parçası. Widget mantığı sunucuda tek yerde (widget.js);
> npm paketi yalnızca script'i enjekte eden tipli yükleyici (Intercom npm
> loader deseni). `portal/[slug]` custom-domain sprint'ine ertelendi (kabul).

- ☑ **`packages/feedl-widget/` (commit 53074f5):** `package.json` (@feedl/widget,
  type module, main/types/files, publishConfig public), `index.js` (ESM:
  `init()` → widget.js'i idempotent enjekte eder, data-* öznitelikleri;
  `identify()` → window.feedlWidget.identify; yüklenmeden önce jetonu
  `__feedlWidgetIdentifyQueue`'da biriktirir), `index.d.ts` (tipler),
  `README.md`, `LICENSE`, `.npmignore`.
- ☑ **`public/widget.js`:** yüklendiğinde `__feedlWidgetIdentifyQueue`'yu
  boşaltıp identify çağrılarını yeniden oynatır (npm loader ile uyumlu).
- ☑ node --check (index.js + widget.js) + npm test (17/17) + build ✓
  → commit → push.
- **Kalan (kullanıcı tarafı):** npm hesabı (org `feedl`?) + `npm login`;
  `npm publish` (ilk yayında `npm publish --access public`); sonra paket
  sürümünü `npm version patch` ve republish ile yönet. Paket `packages/`
  altında, repo kökündeki Next.js build'inden BAĞIMSIZ.

### Sprint 55 — Board Temiz URL `portal/[slug]` (Platformlaşma #3) (✅ 2026-09-05)

> Kullanıcı kararı: `portal/[slug]` bugün yapılsın (önce custom-domain
> sprint'ine ertelenmişti). Daha önceki teşhis: mevcut `portal/[id]` (post
> detay) dinamik segmentiyle `portal/[slug]` aynı derinlikte conflict verir.
> Çözüm: **middleware rewrite** — URL değişmez, board görünümü `?board=`
> render edilir.

- ☑ **`middleware.ts` (commit 835e77a):** `portalBoardRewrite` —
  `/portal/:slug` (uuid değil, ayrılmış static değil: changelog/oyladiklarim)
  → `NextResponse.rewrite('/portal?board=slug')`. URL `/portal/<slug>` olarak
  kalır; `[id]` (uuid) post detayı ve statik sayfalar korunur. Middleware
  boyutu 97.9→98.1 kB (rewrite mantığı).
- ☑ **`app/(main)/portal/page.tsx`:** `buildPortalHref` — ek filtre yoksa
  `/portal/<slug>` (temiz), filtre/sıralama/tag varsa `?board=&…`.
- ☑ Canlı doğrulama: `/portal/ozellik-istekleri` → 200, URL değişmez,
  board adı render; uuid post detay + /portal/changelog + /portal/oyladiklarim
  → 200 (regression yok).
- ☑ npm test (17/17) + build ✓ → commit → push → deploy.

### Sprint 56 — Linear Connector (Madde 2 — ilk parça) (✅ 2026-09-05)

> Madde 2'nin ilk gerçek connector'ı: Linear webhook'u (Issue/Comment/
> CustomerRequest) → AI triage → feedback. Slack/Zendesk desenini izler.
> **Kullanıcı kararı:** şimdilik MANUEL webhook (Linear UI'da oluşturuldu);
> per-workspace otomasyonu (Linear API key + GraphQL webhookCreate) sonraki
> sprint.

- ☑ **`lib/linear.ts`:** verifyLinearSignature (`X-Linear-Signature`,
  gövde HMAC-SHA256 hex, LINEAR_WEBHOOK_SECRET), parseLinearPayload
  (action/type/data), **linearDataText** — Issue/CustomerRequest
  (title+description), Comment (ana issue başlığı + `— yorum`), isLinearConfigured.
- ☑ **`POST /api/integrations/linear/webhook`:** imza doğrulama,
  Issue/Comment/CustomerRequest → classifyWidgetMessage → feedback ise
  users upsert (widget_linear_<id>) + post (source=linear,
  sourceRef=linear:<data.id>) + post/created. Sprint 48q idempotency.
- ☑ middleware `/api/integrations(.*)` zaten public → Linear ek değişiklik yok.
- ☑ npm test (17/17) + build ✓ → commit → push.
- ☑ **Vercel env (`feedl` projesi):** `LINEAR_WEBHOOK_SECRET`
  (lin_wh_…) eklendi. **Kullanıcı Linear webhook'u oluşturdu:** URL
  https://feedl.app/api/integrations/linear/webhook, event'ler
  Issues-CustomerNeeds-Comment.
- ☑ **Canlı doğrulama:** Issue → 200/feedback post (`linear:lin-100001`),
  Comment → 200/feedback post (`linear:lin-com-1002`, başlık
  "Mobil uygulama — yorum"), yanlış imza → 401.
- **Kalan:** per-workspace otomasyonu (Linear API key + `webhookCreate` + DB
  workspace_integrations) — sonraki sprint.

### Sprint 57 — Jira Connector (Madde 2 — kalan) (✅ 2026-09-05)

> Kullanıcı kararı: **API token + webhook** yaklaşımı (OAuth 3LO yerine).
> Jira Automation/Webhook → Issue created/updated → AI triage → feedback.
> **Otomatikleştirme kuralı:** Müşteri elle Automation kuralı KURMAZ — API
> token ile biz `rest/webhooks/1.0` üzerinden webhook'u kaydederiz (Sprint 58).

- ☑ **`lib/jira.ts`:**
  - `isJiraConfigured` (JIRA_WEBHOOK_SECRET), `jiraAuthReady`
    (JIRA_BASE_URL/EMAIL/API_TOKEN), `jiraCreds`, `jiraWebhookUrl`.
  - `registerJiraWebhook`: `events` + `secret` ile `rest/webhooks/1.0`'a
    kaydeder (idempotent — zaten bizim URL'miz varsa atlar). `secret`
    verildiği için Jira `X-Hub-Signature: sha256=<hmac>` imzalar.
  - `verifyJiraSignature`: `X-Hub-Signature` (HMAC-SHA256 ham gövde) VEYA
    `X-Jira-Signature`/`X-Feedl-Token` (statik secret) doğrular.
  - `parseJiraPayload`, `jiraTicketText`, `jiraIdentity`.
- ☑ **`POST /api/integrations/jira/register`:** env kontrolü (isteğe bağlı
  `JIRA_REGISTER_SECRET`), `registerJiraWebhook` çağırır, sonucu döner.
- ☑ **`POST /api/integrations/jira/webhook`:** `X-Hub-Signature` HMAC
  doğrulaması, Issue → `classifyWidgetMessage` → feedback ise users upsert
  (widget_jira_<id>) + post (source=jira, sourceRef=jira:<id|key>) +
  post/created. `?token=` query artık kullanılmıyor.
- ☑ middleware `/api/integrations(.*)` zaten public → ek değişiklik yok.
- ☑ npm test (17/17) + build ✓ → commit → push.
- ☑ **Vercel env (`feedl` projesi — feedl.app):** `JIRA_WEBHOOK_SECRET`,
  `JIRA_API_TOKEN` (çalışan yeni token), `JIRA_BASE_URL`
  (https://feedl.atlassian.net), `JIRA_EMAIL` (oguzkir@gmail.com),
  `JIRA_REGISTER_SECRET` (register ucunu goruma — `X-Register-Secret`
  header). 
  (Not: eski `feedl.co` Vercel projesi silindi; production → `feedl` projesi
  (feedl.app). `JIRA_REGISTER_SECRET` olmadan register 401 döner.)
- ☑ **Canlı doğrulama:** `POST /api/integrations/jira/register` → webhook
  kaydedildi (`events: [jira:issue_created, jira:issue_updated]`,
  `isSigned: true`, id 2). Gerçek Jira issue (`SCRUM-7`, id 10006) → feedl
  post kaydı (`source_ref=jira:10006`) → AI classification feedback. HMAC
  doğrulaması: doğru → 200, yanlış → 401.
- **Kalan:** Jira Automation kuralına gerek YOK. Müşteri akışı (ileride
  workspace ayarları): token + site + email gir → `POST /register` → otomatik
  webhook. Şu an env tabanlı (tek default workspace) çalışıyor; per-workspace
  kayıt ileride.
  Jira webhook payload'ı `{ issue: { id, key, fields: { summary,
  description, creator } } }` şemasında olmalı.

### Sprint 58 — Per-Workspace Linear Otomasyonu (Madde 2) (✅ 2026-09-05)

> Kullanıcı kararı: per-workspace otomasyonu + önerilen sıra (DB → API →
> connect → webhook route → UI). Linear GraphQL `webhookCreate` ile webhook
> OTOMATİK oluşturulur — kullanıcı Linear UI'da manuel kural kurmaz.

- ☑ **DB (`workspace_integrations` migration 0038):** workspace_id, provider,
  webhook_id, webhook_secret, url_token, resource_types, linear_team_id,
  status. `UNIQUE(workspace_id, provider)` + provider index.
- ☑ **`lib/linear-api.ts`:** `linearViewer` (key doğrula), `linearCreateWebhook`
  (GraphQL `webhookCreate` — `resourceTypes` zorunlu, `secret` OLABILIR döner),
  `linearDeleteWebhook`, `linearListWebhooks`. **Gerçek şema teyit:**
  `resourceTypes` enum: Issue/Comment/CustomerNeed (CustomerRequest değil);
  `secret` döner (`lin_wh_…`).
- ☑ **`POST /api/integrations/linear/connect` (admin-only):** `getAdminUserId`
  → Linear key doğrula (`linearViewer`) → workspace slug al → URL
  `?ws=<slug>&t=<32-byte-token>` → `webhookCreate` → record upsert.
- ☑ **Webhook route per-workspace:** `?ws=<slug>&t=<token>` varsa →
  `workspace_integrations` kaydından `urlToken` + `webhookSecret` ile doğrula,
  workspace id'yi slug'dan çöz; `?ws=` yoksa global `LINEAR_WEBHOOK_SECRET`
  + default workspace (geriye dönük uyumlu).
- ☑ **UI (`dashboard/settings`):** `LinearIntegration` kartı — API key input +
  `POST /connect` + başarı/hata durumu. Sprint 58 sonrası: GET (durum) +
  DELETE (disconnect) eklendi.
- ☑ **Disconnect akışı (Sprint 58 ek):** `workspace_integrations.api_key` kolonu
  (migration 0039) — Linear webhook'u uzaktan silmek için. `GET` → durum,
  `DELETE` → Linear `webhookDelete` (saklı apiKey) + yerel kaydı sil.
  UI: bağlıysa durum + "Bağlantıyı kes" butonu.
- ☑ **Doğrulama:** connect no-auth → 403; per-workspace: doğru token+imza →
  200, yanlış token → 401, yanlış imza → 401. GET/DELETE no-auth → 403.
- ☑ `npm run build` ✓ → commit → push (main).
- **Not:** Linear UI commit'i yanlışlıkla `design/modernization` branch'ine
  gitti — `main`'e cherry-pick edildi (8775936).
- **Kalan:** `webhookDelete`/disconnect UI (şu an sadece connect var).

### 📝 Sonraki plan notları (kullanıcı onayıyla erteelenen/planlanacak)

- **Ticarileşme (Paddle):** Canlı tahsilata geç YOK — sandbox'ta kalınacak.
  Kod hazır (overlay checkout + plan limitleri + webhook). Gelecekte:
  `/pricing` pazarlama sayfası, canlı ürün/fiyat ID'leri,
  `PADDLE_WEBHOOK_SECRET` + production API key, gerçek tahsilat testi.
- **Entegrasyonlar (plan notu):** Jira, Linear, GitHub, Intercom dışı
  connector'lar — planlanacak; şu an sadece Slack/Zendesk/Intercom var.
- **Platformlaşma (plan notu):** `@feedl/widget` npm paketi; roadmap'te
  drag-and-drop; custom domain → `portal/[slug]` temiz URL (şu an ?board=).
  Public API: idempotency key + OpenAPI dokümanı.
- **Kalite/güvenlik (plan notu):** E2E/Playwright smoke test; email
  deliverability izleme (bounce/spam); pg_trgm index migration'a kodlama.
- **Repo temizliği (bekle):** `.agents/skills/feedl/code-architect.md` ve
  `design-architect.md` untracked — kullanıcı talimatı bekleniyor (şimdilik
  dokunulmadı).

### Ertelenen blok (en son — kullanıcının kısıtı)

- **Domain (feedl.app) alındı (2026-09-04).** Kod tarafı hazır: tüm
  URL fallback'leri + email footer + widget origin/CORS `feedl.app`'e ve
  `no-reply@mail.feedl.app`'e güncellendi; `NEXT_PUBLIC_APP_URL=https://feedl.app`
  Vercel'e eklenmeli. Kalan işler artık DNS/Vercel/Resend wiring'i:
  Vercel'e feedl.app bağlama + SSL, Resend'de feedl.app domain
  doğrulaması (SPF/DKIM/DMARC) + `RESEND_API_KEY` + `EMAIL_FROM`,
  `hi@feedl.app` yönlendirme (Squarespace, hazır).
- **Hâlâ erteleme gerekli değil ama kod dışı:** Workspace/Organizations UI
  + çoklu tenancy (P0.1 veri temeli Sprint 37'de kuruldu; Organizations UI,
  subdomain yönlendirme, board erişim politikaları (P0.2),
  custom domain + markalama, üçüncü taraf entegrasyonları (P4.3:
  Slack/Intercom/Jira...), billing/plan limitleri — bu sprint'ler artık
  aktifleşebilir, ilgili sprint'te kod + env değişikliği yapılır.

### ⚠️ Mimari risk notu (P0.1 ertelenmesi hakkında)

Rapor, workspace/board modelini "önce yapılmalı" (P0) diye işaretliyor;
ancak feedl MVP'de tek workspace/tek admin geçerli ve Organizations
domain gerektirdiğinden ertelendi. Riski azaltmak için Sprint 20–34'te
oluşturulacak tüm yeni tablolar (changelog, followers, companies vb.)
tek migration ile `workspaceId` eklenebilecek şekilde tutulur (rapor
§5 migration stratejisi).

---

## 🎨 Faz 4: Tasarım Dili (2026-09-04)

> Dış kaynaklı tasarım referansı (e36376b) silindi; tasarım dili
> sıfırdan tanımlanıyor. Yön: kategorideki rakipler (Canny, Frill,
> Nolt, Featurebase, UserJot) mavi/mor denizinde — mercan accent ile
> ayrışma; "geri bildirim = insan sesi" tonu.

### Sprint 35: Marka Temeli — Renk + Font ✅

**Karar (kullanıcı onaylı):** Accent = mercan `#ff5c35`, font =
Manrope (latin-ext, Türkçe destekli; Geist Mono korunur).

- `app/globals.css`:
  - Marka token'ları: `--brand` (#ff5c35), `--brand-strong` (açık
    zeminde AA metin #c7360f; koyu zeminde #ff8c66), `--brand-soft` /
    `--brand-tint` (saydam zeminler) + `.dark` karşılıkları. `@theme
    inline` üzerinden `text-brand`, `bg-brand-soft` vb. utility'ler
    açıldı.
  - `--primary` → mercan; **`--primary-foreground` → koyu mürekkep
    `#2b0e04`** (white-on-coral 3.1:1 AA başarısız; ink-on-coral
    5.9:1 ✓). Işık/koyu modda aynı buton işlemesi.
  - `--ring` → mercan (`#ff8c66`) her iki modda.
  - Başlıklara (h1–h4) `-0.02em` tracking.
  - Düzeltme: `--font-sans: var(--font-sans)` self-referans hatası
    giderildi → next/font değişkeni `--font-app-sans` olarak bağlandı;
    font değişken sınıfları body'den html'e taşındı.
- `app/layout.tsx`: Geist Sans → Manrope (latin + latin-ext).
- Korunanlar: StatusBadge anlamsal renkleri, widget izole CSS'i,
  e-posta şablonları (sistem fontu), Clerk bileşen teması.
- Not: Destructive (kırmızı) mercanla aynı sıcak ailede — canlıda
  karışıklık görülürse destructive derinleştirilecek.
- Doğrulama: `npm run build` ✓. Sonraki: canlıda kullanıcı onayı,
  ardından portal/dashboard polish (Sprint 36).

### Sprint 36: Komple Tasarım Revizyonu ✅

> `front_end.md` skill rehberliğinde, tek seferde değil küçük batch'ler
> halinde; her batch ayrı commit + canlı doğrulama. Kullanıcı tüm listeyi
> canlıda test etti.

- **a) Kabuk** (`a85031c`): Yeni `components/custom/site-header.tsx`
  (marka karosu + mercan zemin, `usePathname` ile aktif nav vurgusu;
  `/portal/changelog` hariç `/portal*` Portal'ı aktif eder).
  `(main)/layout.tsx`'e footer + `flex min-h-svh flex-col` iskeleti.
  Landing asimetrik hero'ya çevrildi (sol metin / sağda mock kart +
  Autopilot şeridi) + "Nasıl çalışır" 1-2-3 şeridi (Topla/Anla/Duyur).
- **b) Portal + Dashboard** (`5abecb0`): Inline butonlar `Button`'a
  bağlandı (dashboard aksiyonları `render` prop ile); istatistik
  sayıları `font-mono`; portal kart girinti anomalisi giderildi.
- **c) Roadmap + hata sayfaları** (`5dd9436`): Emoji kolon başlıkları
  → `columnDotStyles` renkli noktalar (planned/in-progress/shipped;
  StatusBadge renkleriyle eşleşir); 404 ve error sayfa butonları
  `Button`'a bağlandı.
- **d) Tema değiştirici** (`32e22e2`): `next-themes` kuruldu; üst bara
  switch (açık: güneş / koyu: mercan zeminde ay). `ThemeProvider`
  `(main)/layout.tsx`'te (`attribute="class"`, varsayılan: sistem) —
  `/widget` bare layout'ta kaldığı için izole. Yeni dosyalar:
  `theme-provider.tsx`, `theme-toggle.tsx`.
- **e) Doğrulama:** `npm run build` ✓; `app/**` içinde inline `bg-primary`
  buton kalıntısı yok; koyu mod mercan token'ları pariteli. Tema geçişi,
  kalıcılık, sistem tercihi, koyu modda tüm ekranlar, Clerk ekranları ve
  widget — canlıda hepsi çalışıyor.

---

## 💳 Faz 5: Para Kazanma (Paddle) (2026-09-04)

> Ödeme altyapısı kararı: **Paddle** — canny.md §F'deki "Polar.sh veya
> Lemon Squeezy" notunun yerine geçer. Paddle merchant of record
> olduğundan vergi/fatura yükünü da üstlenir. Sandbox ortamıyla başlanacak.

### Kararlar ve ortam

- Resmi doküman becerisi: `npx skills add https://developer.paddle.com/`
  (Paddle dokümanlarından ajan skill'i kurulur).
- **Sunucu tarafı** (API çağrıları, webhook, güvenilir entegrasyonlar):
  API key → `PADDLE_API_KEY` (gizli; değer `.env.local`'de, repaya
  yazılmaz).
- **Ön yüz** (Paddle.js overlay checkout): client-side token →
  `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (herkese açık by design).
- Şu an **sandbox** ortamı: anahtar önekleri `pdl_sdbx_apikey_…` /
  `test_…`. Canlıya geçişte production değerleri aynı değişkenlere
  yazılır.
- Webhook imza doğrulaması için ileride `PADDLE_WEBHOOK_SECRET`
  eklenecek.
- Plan modeli (canny.md §F temelli): Free katmanı + tracked-user
  tabanlı ücretli planlar; "Powered by feedl" free planda kalır.
  Fiyat/paket detayı uygulama sprint'inde netleşir.
- **İsimlendirme çakışması:** Paddle hesabında başka bir projeye ait
  mevcut veriler/ayarlar var. feedl'e ait her şey `feedl_` önekiyle
  adlandırılır (ürün/fiyat/indirim adları, webhook adları, custom_data
  anahtarları); mevcut projenin kayıtlarına dokunulmaz. Sandbox hesabı
  iki proje tarafından paylaşıldığından hesap geneli ayarlarda
  (varsayılan checkout, payment link domain vb.) değişiklik yapılmadan
  önce kullanıcıya sorulur.

---

## 🚨 Önemli Notlar (AI Ajanına Uyarı)

- **Hata Yönetimi:** Her API route'unda `try-catch` kullan.
- **TypeScript:** Tüm fonksiyonlar kesinlikle tip güvenli olsun.
- **Migration:** Drizzle ile migration yapmayı unutma (`drizzle-kit generate` ve `drizzle-kit migrate`).
- **Güvenlik:** Admin route'larında mutlaka `auth()` kontrolü yap ve `role` kontrolü ekle.

---

## 📚 Referans Dokümanlar

- **`DESIGN.md` (repo kökü) — TASARIM REFERANSI:** Sprint 35–36 tasarım
  dilinin tek kaynağı — marka aksanı (mercan `#ff5c35` + koyu mürekkep),
  tipografi (Manrope + Geist Mono), kabuk, bileşen envanteri, koyu mod
  kuralları, dokunma kuralları. Yeni bileşen/ekran işinde önce buraya bak.
  Bileşen primitive'leri için `@base-ui/react` (Base UI) dokümantasyonu,
  görsel bakış için `.agents/skills/feedl/front_end.md` kullanılır.
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
