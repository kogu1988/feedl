# feedl — Birleştirilmiş Ürün Durum Raporu (PM)

> Kaynak: `docs/Feedl–Canny Fonksiyonel Parite Analizi.md` (önceki rapor)
> + `docs/FEEDL_CANNY_RESCAN_2026-09-04_TR.md` (güncel yeniden tarama,
> taban commit `32e22e2`) + Sprint 20–36 / tasarım dili / Paddle kararı.
> Tarih: 4 Eylül 2026.

## 1. Yönetici Özeti

feedl, 2 ay önce **tek fikir listesi + oylama** olan bir MVP'den, bugün
**fikir detayı, yorumlar, merge/unmerge, etiket/tip, admin triage +
saved views, bağımsız changelog, bildirim merkezi, hibrit arama, iç
roadmap/scoring, şirket/fırsat/gelir skoru, embed widget, Autopilot inbox
ve read-only public API/webhook** içeren *oldukça gelişmiş bir feedback
platformuna* dönüştü. Tasarım dili de oturdu: mercan marka, Manrope, koyu
mod, yeni kabuk/footer/hero.

**Ama iki stratejik eksik hâlâ duruyor:** (1) **tek workspace/tek tenant
mimarisi**, (2) **üçüncü taraf entegrasyonları**. Bu yüzden feedl bugün
Canny'nin tam SaaS/enterprise paritesi değil, **çok iyi bir "tek-ürün
Canny Lite + platform temeli"** konumunda. Yeni özellik eklemek yerine bu
ikisinin (özellikle tenant temelinin) sırasıyla ele alınması gerektiği iki
raporda da net; **ben de katılıyorum.**

Kritik PM içgörüsü: **Paddle ile para kazanma kararı doğru, ama plan
limitleri (tracked-user / iş yeri başına kullanıcı) ancak workspace/board
tenant modeli anlamlı hale gelir.** Yani ödeme altyapısı tenant temeli
olmadan kurulamaz; sıralama bu yüzden **tenant önce** demektir.

## 2. Yapılanlar (Kanıtlanmış Durum)

| Alan | Durum | Not |
|---|---|---|
| Portal / fikir detayı | Public portal, arama, yeni fikir, oy + `/portal/[id]` kanonik detay sayfası, benzer fikirler, "Oyladıklarım" | Detay sayfası en büyük UX kazanımı |
| Oylama | Tekil oy + geri alma, müşteri sayısı + gelir skoru bağlamı | Sağlam |
| Yorumlar | Public/internal görünürlük, tek seviye thread, edit/delete, reply, e-posta | Çekirdek döngü tamam |
| Duplicate | AI tespiti → merge/unmerge, oy/yorum taşıma, audit, inbox onayı | **Büyük gelişme** |
| Admin | Bulk status/tag, saved views, filtreler, sıralama, zengin tablo | Operasyonel hale geldi |
| Status | 6 status + history + değişim notu; roadmap kolonları ayrı | Gelişme |
| Changelog | Ayrı entry/link modeli + public sayfa | **Markdown/görsel/abonelik eksik** |
| Bildirimler | Takipçi, tüm status, yorum bildirimi, tercih, unsubscribe, idempotency | **Büyük gelişme** |
| Arama | Full-text + trigram + boş sonuçta vector fallback | Teknik gelişme |
| İç roadmap | Owner, tarih, impact/effort, skor | Tamam; RICE yok |
| Analytics | Son N gün sayaçları, duygu/top 5, CSV | İlk sürüm |
| Şirket/gelir | Companies, members, MRR, opportunities, revenue score | **Çok büyük gelişme** |
| Widget | Launcher + iframe overlay + JWT identify + widget API | Lite parite |
| Public API | `/api/v1/posts`, scoped key, rate limit, HMAC webhook | İlk sürüm; kapsam dar |
| Autopilot | Inbox, pending/approve/reject/ignore, merge onayı, audit | **Büyük gelişme** |
| Tasarım/marka | Coral, Manrope, yeni shell/footer/hero, koyu mod, 404/error | Oturdu |

> Build/lint ikisinde de temizdi; kod seviyesinde görülen regresyon yok.
> Tema değiştirici + Paddle kararı en son eklenen parçalar — ürün
> mantığını değiştirmedi.

## 3. Yapılması Şart Olanlar (P0/P1) vs Olması İyi Olurlar (P2/P3)

### 🔴 Şart (kritik yol, öncelikli)

| # | İş | Neden şart |
|---|---|---|
| 1 | **Workspace/board tenant migration** + merkezi tenant scope helper | Sonraki HER özelliğin yeniden yazılmasını önler; plan limitleri (Paddle) bunun üzerine kurulur |
| 2 | **Widget origin allowlist zorunlu** | Boş allowlist = her origin kabul → public yüzeylerde sızıntı |
| 3 | **Paylaşımlı rate limit** (Redis/Upstash) | Süreç-içi 60/dk sunucular arası ortak değil |
| 4 | **Server-side pagination** (cursor) + indeks | 200 kayıt sınırı ölçeklemede kırılır |
| 5 | **Test/CI altyapısı** (`npm test`, critical-flow smoke) | Manuel doğrulama riski |

### 🟡 İyi olur (değer artırıcı, tenant sonrası)

| # | İş | Not |
|---|---|---|
| 6 | Comments polish: @mention, private end-user, markdown, attachment, comment summary | Ekip işbirliği derinliği |
| 7 | Changelog: markdown render, görsel, custom label, subscription | Release loop'u tamamlar |
| 8 | Generic custom fields + board-configurable categories | Triage esnekliği |
| 9 | Full API/webhook event matrix (write, vote, comment, changelog, retry/dead-letter) | Entegrasyonu mümkün kılar |
| 10 | İlk canlı connector (Intercom/Zendesk → Slack → Jira/Linear) | Autopilot değerini kanıtlar |
| 11 | Gelişmiş revenue/reporting: segment MRR, renewal risk, churn, dealbreaker | Farklılaşma katmanı |
| 12 | **Billing/plan limitleri + custom domain** (Paddle hazırlığı) | Ticari kullanıma geçiş |

## 4. Eksikler / Revize Gerektirenler

- **Tenant izolasyonu yok:** "Company" tablosu müşteri profili sağlıyor
  **ama tenant izolasyonu sağlamıyor**. Özellik eklemeden `workspaceId` /
  `boardId` eklenmezse sonra tüm tablolar (changelog, followers, companies,
  opportunities, api_keys) geriye dönük yeniden yazılır.
- **Revenue score sadece `oy + 10×müşteri + (MRR + açık fırsat)/1000`** —
  generic scoring engine değil; "skor" ile gerçek karar desteği arasındaki
  netlik farkı büyük.
- **API key at-rest:** build'de `hashApiKey` ve `timingSafeEqual`
  **kullanılmayan import** olarak görünüyor → API key'in gerçekten
  hash'lenip hashlenmediğini **doğrula**. Düz metin depolama riski yüksek.
- **Arama migration bağımlılığı:** `pg_trgm` index'i yeni ortamda manuel
  kuruluyor → migration'a kodla, fresh DB smoke testi ekle.
- **Webhook olayları dar:** `deleted`, `vote.created/deleted`, `changelog`
  yok → event matrix eksiği.
- **"Follow" UX belirsiz:** takip davranışı kullanıcıya açık gösterilmiyor;
  takipten çıkma + tür bazlı tercih UI'ı yok.
- **Status not sözleşmesi:** tekil satır vs bulk akışındaki "not alanı"
  davranışı birleştirilmeli (kullanıcı "not alanı çıkmadı" demişti —
  bilinçli kapsam ama servis edilirse status history'ye aç).
- **Revize:** E-posta şablonları kullanıcı taraflı içerikle
  biçimlendiriliyor — sanitize + preview destekli; ama Resend gerçek
  deliverability (bounce, spam, domain warming) hâlâ tek nokta.

## 5. Performans Analizi

| Ölçüt | Durum | Yorum |
|---|---|---|
| First Load JS (son build) | `/` 224 kB, `/portal` 362 kB, `/portal/[id]` 395 kB, `/dashboard` 302 kB, ortak 139 kB | Makul ama detay sayfası en ağır; lazy-load + `next/dynamic` ile düşürülebilir |
| Rate limit | Süreç-içi, sunucular arası ortak değil → **riskli** | Redis/Upstash şart |
| Pagination | `limit(200)` ve cursor yok → **riskli** | Server-side cursor şart |
| Arama | Full-text + trigram + vector fallback | İyi; trigram index'i migration'a bağlı (kırılgan) |
| Font/asset | next/font (Manrope/Geist) → harici font isteği yok | İyi |
| Ölçekleme | Neon serverless; sorgu tenant scope'suz büyük sette yavaşlar | Tenant scope ile indeksleme iyi olur |
| Kırılma noktası | 200 kayıt + paylaşımsız limiter + tenant'sız sorgular | Birkaç yüz post sonrası Admin tablosu ağrır |

**Performans özeti:** Bugün sıkıntı yok ama büyüme hazırlığı zayıf; üç eşik
(paginate, shared limiter, tenant index) ölçeklemenin kilididir.

## 6. Güvenlik Analizi

| Yüzey | Durum | Önem |
|---|---|---|
| Widget origin allowlist | Boşsa her origin kabul → **kritik** | Production'da boş değeri reject et |
| Widget JWT identify | İmzalı kısa ömürlü token var | İyi; expiration + audience/issuer kontrolü doğrula |
| API key hash | `hashApiKey`/`timingSafeEqual` kullanılmıyor olabilir → **doğrula** | Düz metin riski |
| Webhook HMAC | İmzalı teslimat var | İyi; retry/dead-letter eksik |
| Tenant veri ayrımı | **Yok** | En büyük risk; tenant scope helper'ı şart |
| AI PII | Kullanıcı içeriği OpenRouter'a gidiyor; retention varsa soru | Prompt injection + PII maskesi + tenant bağlam ayrımı zorunlu |
| Clerk/CORS | Clerk session + DB role; widget iframe origin | Doğrulandı; allowlist ilişkisi izle |

**Güvenlik özeti:** İki tanesi (widget allowlist, tenant scope) hemen
yapılmalı; biri (API key hash) **doğrulanmalı**; biri (AI PII/tenant)
mimariyle birlikte çözülmeli.

## 7. UI-UX Analizi

**Güçlü yönler:** Mercan tek aksan + ink mürekkep (AA 5.9:1),
Manrope/Geist Mono, koyu mod (sistem tabanlı, widget etkilenmeden),
asimetrik hero + "Nasıl çalışır" şeridi, thread-safe header/footer,
404/error sayfaları buton tutarlılığı. Rakiplerin mavi/mor denizinden net
ayrışıyor. StatusBadge / roadmap kolon noktaları / SentimentBadge aynı dili
konuşuyor.

**İyileştirilecekler:**

- Fikir detay sayfası kanonik olmuş ama **pagination olmadığı için** liste
  uzunluğunda UX bozulur.
- Saved views / filtre sıralaması ile `limit(200)` çelişiyor; büyük
  listelerde "kayıp veri" hissi.
- **"Follow"** kullanıcıya görünür bir anahtar değil → takip/bildirim
  tercihi açık olmalı.
- Changelog detail'de markdown/görsel yok → release note zayıf.
- Status history kullanıcı tarafında açık değil (admin işi gibi duruyor).
- Widget tema/branding'i (coral) embed'e taşınmış mı — kontrol edilmeli.
- Koyu modda Clerk ekranları koyulaşıyor ama **widget'ın koyu moda
  zorlanmaması** bilinçli; korunmalı.

## 8. PM Önerim: Sıradaki Adım Sırası

1. **Workspace/board hazırlık migration'ı + merkezi tenant scope helper**
   (Paddle plan limitlerini mümkün kılar) → *şart*
2. **Widget origin zorunlu + paylaşımlı rate limit + API key hash
   doğrulama** → *şart, güvenlik*
3. **Server-side pagination + test/CI** → *şart, büyüme hazırlığı*
4. Comments/changelog polish
5. Custom fields + categories
6. Full API/webhook event matrix → (bu, entegrasyonu açar)
7. İlk canlı connector
8. Workspace/board UI + private access + role matrix + custom domain
9. Gelişmiş revenue/reporting
10. Paddle billing/plan limitleri

**Tek cümle:** "Fonksiyonel olarak Canny'ye çok yaklaştık; artık tek
müşteriye satılabilecek güvenlik/ölçek temelini (workspace + allowlist +
pagination + test) kurup, Paddle'ı bu temelin üzerine oturtmalıyız." Tam
SaaS paritesi için tenant önce gelir; hızlı demo için ise güvenlik/test +
ilk entegrasyon önce yapılır.
