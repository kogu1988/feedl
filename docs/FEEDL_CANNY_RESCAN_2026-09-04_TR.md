# Feedl–Canny Son Durum Yeniden Tarama Raporu

**Karşılaştırma tabanı:** Önceki analiz commit’i `51d10f27`  
**Güncel GitHub commit’i:** `32e22e2` — `Add theme toggle to site header`  
**Repo:** [github.com/kogu1988/feedl](https://github.com/kogu1988/feedl)  
**Tarama tarihi:** 4 Eylül 2026

## Yönetici özeti

Önceki rapordan bu yana proje **önemli ölçüde büyümüş ve Canny’ye fonksiyonel olarak çok daha fazla yaklaşmıştır**. En büyük kazanımlar; yorumlar, post detay sayfası, merge/unmerge, etiket ve post tipi, admin bulk actions ve saved views, status history, bağımsız changelog, bildirim merkezi, hibrit arama, internal roadmap/scoring, analytics, şirket profilleri, fırsatlar ve gelir skoru, embed widget, Autopilot inbox ile public API/webhook katmanlarının gerçekten kodlanmış olmasıdır.

Bu özelliklerin büyük bölümü yalnızca dokümantasyonda değil, güncel şema/migration, API route ve UI bileşenlerinde yer alıyor. Güncel repo 32e22e2 commit’inde; son dönemde ayrıca shell/landing hero, header/footer, coral marka rengi, Manrope fontu, tema değiştirici, hata/404 ve buton tutarlılığı gibi ürün cilası yapılmış. Build, lint ve `git diff --check` kontrolleri başarıyla geçmiştir; bu taramada doğrudan görülen bir build veya biçimsel regresyon yoktur.

Buna rağmen iki kritik stratejik eksik devam ediyor: **tek workspace/tek tenant mimarisi** ve **üçüncü taraf entegrasyonları**. Bunlar ertelendiği için Feedl şu anda Canny’nin tam SaaS/enterprise paritesi değil, oldukça genişlemiş bir **tek-ürün Canny Lite + platform temeli** konumundadır.

## 1. Önceki rapora göre hızlı durum tablosu

| Alan | Önceki rapor | Güncel durum | Değişim |
|---|---|---|---|
| Portal ve post listesi | Public portal, arama, yeni fikir, oy | Detay sayfası, tag/type/sentiment, shipped ayrımı, “Oyladıklarım”, benzer fikirler | **Belirgin gelişme** |
| Oylama | Tekil oy ve geri alma | Aynı yapı korunuyor; müşteri sayısı ve gelir skoru bağlamı eklendi | **Gelişme** |
| Comments | Eksik | Public/internal, tek seviye thread, edit/delete, reply, e-posta | **Tamamlandı; kısmi ileri eksik** |
| Duplicate yönetimi | AI tespiti, operasyonel merge eksik | Merge/unmerge, oy/yorum taşıma, audit, inbox onayı | **Büyük gelişme** |
| Tags/categories | Eksik | Post type + serbest tags + portal/admin filtreleri | **Lite parite** |
| Admin triage | Basit tablo | Bulk status/tag, saved views, filtreler, sıralama, enriched table | **Büyük gelişme** |
| Status modeli | 4 sabit status | 6 status + history + değişim notu; roadmap kolonları ayrı | **Gelişme** |
| Changelog | “Yayında” listesi | Ayrı entry/link modeli, public sayfa, admin oluşturma/silme | **Büyük gelişme; markdown/abonelik eksik** |
| Bildirimler | Shipped e-postası | Takipçiler, tüm status bildirimleri, yorum bildirimleri, tercihler, unsubscribe, idempotency | **Büyük gelişme** |
| Arama | ILIKE | Full-text + trigram + boş sonuçta vector fallback | **Teknik gelişme** |
| Internal roadmap | Yok | Owner, hedef tarih, impact/effort, skor | **Tamamlandı; RICE ve board kapsamı eksik** |
| Analytics | Yok, yalnız CSV | Dönem bazlı temel dashboard, duygu/top 5, geniş CSV | **İlk sürüm tamamlandı** |
| Company/revenue | Yok | Companies, members, MRR, opportunities, deal value, revenue score | **Çok büyük gelişme** |
| Widget | Yok | Launcher + iframe overlay + JWT identify + widget API | **Lite parite** |
| Public API/webhook | Yok | Read-only `/api/v1/posts`, scoped key, rate limit, HMAC webhook | **İlk sürüm tamamlandı; kapsam dar** |
| AI Autopilot | Post sonrası analiz | Inbox, pending/approve/reject/ignore, merge onayı, audit mantığı | **Büyük gelişme; source ingest/spam eksik** |
| Multi-tenant/boards | Yok | Hâlâ yok; bilinçli ertelenmiş | **Aynı kaldı** |
| Dış entegrasyonlar | Yok | Hâlâ yok | **Aynı kaldı** |
| Tasarım/marka | Basit MVP görünümü | Coral marka, Manrope, yeni shell/footer/hero, dark mode, 404/error polish | **Gelişme** |

## 2. Belirgin gelişmeler

### 2.1. Ürün artık yalnızca fikir listesi değil

Önceki sürümde portal deneyimi esas olarak fikir kartları, oylama, status ve roadmap etrafında dönüyordu. Güncel sürümde `/portal/[id]` kalıcı fikir detay sayfası haline gelmiş; tam açıklama, oy durumu, yorumlar, admin-only AI/müşteri/fırsat kutuları, merge durumu ve embedding tabanlı benzer fikirler aynı yerde birleşmiştir. Bu değişiklik, Canny’deki “post detail = feedback kaydının kanonik çalışma alanı” modeline yaklaşan en önemli kullanıcı deneyimi kazanımıdır.

### 2.2. Yorumlar ve ekip iletişimi gerçek bir özellik haline geldi

`comments` tablosu artık public/internal görünürlük, parent ilişkisi ve düzenlenme zamanını taşıyor. Kullanıcı kendi yorumunu düzenleyip silebiliyor; admin tüm yorumları yönetebiliyor; tek seviyeli yanıt ve yorum/yanıt e-postaları mevcut. İç notların son kullanıcıya sızmaması server-side filtrelerle korunuyor.

Canny paritesi henüz tam değildir. Feedl’de thread yalnızca tek seviyelidir; `@mention`, kullanıcı etiketleme, private end-user comments, zengin markdown/render ve yorum özetleme bulunmuyor. Dolayısıyla temel iletişim döngüsü tamamlanmış, ekip işbirliği katmanı ise kısmen tamamlanmıştır.

### 2.3. Duplicate tespitinden duplicate operasyonuna geçildi

Önceki sürümde AI duplicate sonucu `duplicateOf` alanına yazılıyordu; adminin bunu güvenli biçimde birleştirme yolu yoktu. Güncel sürümde `post_merges` audit tablosu, `mergedIntoId`, oy/yorum taşıma izi ve unmerge akışı bulunuyor. Ayrıca Autopilot artık duplicate kararını sessizce uygulamak yerine `ai_suggestions` tablosunda pending öneri olarak inbox’a bırakabiliyor. Bu değişiklik Canny’nin “AI önerir, ekip onaylar; otomatik modda audit log tutulur” yaklaşımına belirgin biçimde yaklaştırıyor.

### 2.4. Admin paneli operasyonel hale geldi

Admin panelinde artık satır seçimiyle toplu status/tag güncelleme, saved views, status/type/tag filtreleri, müşteri ve gelir skoru, internal roadmap planlama, changelog yönetimi, Autopilot inbox, API key ve webhook yönetimi bulunuyor. Bu, önceki basit status dropdown’ından ürün ekibinin günlük triage yapabileceği bir çalışma alanına geçiştir.

Yine de admin listeleme `limit(200)` varsayımına dayanıyor ve server-side pagination yok. Bu, düşük hacimde sorun değildir; ancak Canny sınıfı SaaS kullanımında büyüme öncesi ele alınması gereken bir ölçekleme açığıdır.

### 2.5. Roadmap, changelog ve karar destek katmanı ayrıştı

Status history ve status değişim notları eklendi. Public roadmap’te planned/in-progress/shipped kolonları korunurken under-review ve closed roadmap dışında tutulmuş; bu Canny’nin public status ile roadmap kolonlarını ayıran modeline yakındır. Ayrıca `changelog_entries` ve `changelog_post_links` sayesinde “Yayında” listesi artık bağımsız release note alanına dönüşmüştür.

Internal roadmap tarafında owner, target date, impact ve effort alanları ile `impact / effort` skoru sunuluyor. Company, MRR ve opportunity verileri eklendiği için admin artık yalnız oy sayısına değil, müşteri ve ticari değere göre önceliklendirme yapabiliyor.

### 2.6. Canny benzeri platform yüzeyi oluştu

Widget launcher, iframe overlay, JWT tabanlı identify ve widget üzerinden post/vote API’leri eklenmiş. Public API `/api/v1/posts` ile read-only erişim, scoped API key, 60 istek/dakika süreç-içi rate limit ve HMAC imzalı webhook teslimatı var. Bu parçalar henüz Canny’nin tam API/SDK kapsamı değil, fakat platformlaşmanın doğru yönündedir.

## 3. Aynı kalan veya yalnızca kısmen değişen alanlar

| Alan | Güncel değerlendirme |
|---|---|
| Workspace/organization/board | **Değişmedi.** Veriler hâlâ global/tek workspace yaklaşımında. `workspaceId`, `boardId`, üyelik ve board erişim modeli yok. |
| Çoklu müşteri izolasyonu | **Değişmedi.** Companies tablosu müşteri profili sağlıyor; tenant izolasyonu sağlamıyor. “Company” ile “workspace/customer tenant” birbirine karıştırılmamalı. |
| Dış entegrasyonlar | **Değişmedi.** Slack, Intercom, Zendesk, Help Scout, Gong, review kaynakları ve Jira/Linear/GitHub gibi canlı connector’lar yok. |
| Canny API paritesi | **Kısmi.** Feedl API’si yalnız post listesi/detayı okuyor; Canny’deki board, category, comments, users, votes, tags, companies, changelog ve write endpoint kapsamı yok. |
| Widget güvenliği | **Kısmi.** İmzalı JWT var; fakat `FEEDL_WIDGET_ALLOWED_ORIGINS` boş bırakılırsa her origin kabul ediliyor. Production’da allowlist zorunlu hale getirilmeli. |
| AI kaynak ingest’i | **Kısmi.** Feedl’in Autopilot’u portal postlarını ve duplicate önerilerini işliyor; harici konuşma/review kaynaklarını izlemiyor. |
| AI spam/Smart Reply/comment summary | **Eksik.** AI inbox’ta duplicate aksiyonu var; spam sınıflandırması, Smart Reply ve yorum özetleme yok. |
| Custom fields | **Kısmi.** Post type, tag, owner, tarih, impact/effort mevcut; yönetilebilir generic custom-field definition/value sistemi yok. |
| Categories | **Kısmi.** Canny category modeline karşılık postType + tags kullanılmış; ayrı board bazlı category taksonomisi yok. |
| Changelog | **Kısmi.** Entry, post-link, label görünümü mevcut; markdown rendering, görsel yükleme ve changelog e-posta aboneliği eksik. |
| Reporting | **Kısmi.** Temel son N gün sayaçları, sentiment/top 5 ve CSV var; Canny’nin Ideas/Autopilot/Portal bölümleri, drill-down, müşteri talepleri, satış pipeline’ı, churn ve theme trend raporları yok. |
| Auth/roller | **Kısmi.** Clerk ve DB tabanlı admin kontrolü çalışıyor; organization üyelikleri, contributor/manager/owner ayrımı ve SSO yok. |

## 4. Gerileme analizi

### 4.1. Doğrudan tespit edilen regresyon yok

Güncel `origin/main` commit’i ayrı çalışma ağacında incelendi. `git diff --check` hata vermedi. Bağımlılıklar kurulduktan sonra `npm run build` ve `npm run lint` başarıyla tamamlandı. Güncel build çıktısında portal, detay, roadmap, changelog, şirketler, widget, API ve webhook route’ları derlenebilir görünüyor. Bu kontroller, kod seviyesinde bariz bir derleme veya biçimsel gerileme olmadığını gösterir.

### 4.2. Ürün ve operasyon seviyesinde dikkat edilmesi gereken riskler

Bunlar mevcut bir özelliğin kaybedildiği anlamında regresyon değildir; yeni özelliklerin oluşturduğu veya görünür hale getirdiği risklerdir.

| Risk | Neden önemli | Önerilen önlem |
|---|---|---|
| Workspace’in ertelenmesi | Companies ve opportunities eklenmiş olsa da veriler tenant’a ayrılmıyor. | Yeni özellik eklemeden önce workspace/board migration planını başlat. |
| Widget allowlist boşluğu | Boş allowlist tüm origin’leri kabul edebiliyor. | Production’da boş değeri reject et; origin eşleşmesini zorunlu kıl. |
| Rate limit süreç-içi | Serverless instance’ları arasında ortak sayaç yok. | Redis/Upstash veya edge-compatible paylaşımlı limiter ekle. |
| API kapsamının dar olması | Public API yalnız post read operasyonlarına yakın. | Versioned write API, comments/votes/users/tags/changelog ve idempotency ekle. |
| Webhook olaylarının sınırlı olması | Deleted/vote.created/vote.deleted/changelog gibi olaylar yok. | Event matrix ve retry/dead-letter/delivery log ekle. |
| Arama migration bağımlılığı | pg_trgm index’i yeni ortamda manuel kuruluyor. | Migration’ı kodla ve fresh database smoke test ekle. |
| Test otomasyonu | `package.json` içinde test script’i yok; doğrulama çoğunlukla manuel. | Vitest/Playwright, migration test ve critical-flow CI ekle. |
| Pagination eksikliği | Dashboard 200 kayıt sınırına dayanıyor. | Cursor pagination ve server-side filtering/sorting ekle. |

## 5. Önceki önerilerden hangileri tamamlandı?

Önceki Canny parite raporundaki P1–P5 planının büyük bölümü artık uygulanmıştır. P1 kapsamında post detail, comments, merge/unmerge, tags/type, bulk actions, saved views ve status history tamamlanmıştır. P2 kapsamında bağımsız changelog, bildirim merkezi ve internal roadmap/scoring tamamlanmıştır. P3 kapsamında companies, company members, müşteri sayacı, opportunities ve revenue score tamamlanmıştır. P4 kapsamında widget SDK’nin lite sürümü ile read-only public API ve webhook’lar tamamlanmıştır. P5 kapsamında Autopilot inbox ve insan onaylı duplicate akışı tamamlanmıştır.

Önceki raporun hâlâ geçerli olan veya revize edilmesi gereken ana önerileri şunlardır: workspace/organization + board modeli, board erişim politikaları, gerçek custom fields, Canny kapsamına yakın API write yüzeyi, üçüncü taraf connector’lar, Autopilot source ingest/spam, gelişmiş reporting ve production billing/plan limitleri.

## 6. Bundan sonra eklenmesi gerekenler

### P0 — Mimari borcu şimdi azalt

Workspace, board ve tenant izolasyonu artık ertelenmemelidir. Domain ve subdomain daha sonra yapılabilir; ancak veri modeline şimdiden `workspaceId` ve `boardId` eklemek için geriye dönük migration hazırlanmalıdır. Mevcut tek portal varsayılan workspace/default board olarak migrate edilmelidir. Yeni şirket, fırsat, changelog, follower ve API key kayıtları tenant kapsamı taşımadan büyütülmemelidir.

Board erişimi public, authenticated, private ve belirli üyelerle sınırlı modlara ayrılmalıdır. Admin rolleri owner/manager/contributor gibi permission’lara ayrılmalı; yalnızca `role=admin` kontrolüne dayalı global model bırakılmalıdır.

### P1 — Mevcut özellikleri production seviyesine çıkar

İlk olarak widget origin allowlist boş olduğunda isteği reddeden güvenlik kuralı eklenmelidir. Ardından API rate limit’i paylaşımlı store’a taşınmalı, HMAC webhook delivery kayıtları ve retry/dead-letter ekranı eklenmelidir. `pg_trgm` ve diğer extension/index gereksinimleri fresh database migration testinde otomatik doğrulanmalıdır.

Dashboard için server-side cursor pagination, filtre/sıralama query contract’ı ve indeksler eklenmelidir. `npm test` tabanlı unit/integration testleri ve en azından portal → post → vote → comment → admin status → notification ile widget → identify → post/vote akışlarını kapsayan Playwright smoke testleri kurulmalıdır.

### P2 — Canny çekirdek paritesini tamamla

Comments tarafında @mention, private end-user comment modu, daha zengin markdown, attachment ve comment summary eklenmelidir. Changelog markdown render, görsel yükleme, custom labels ve changelog subscription ile tamamlanmalıdır. Post custom fields generic bir definition/value sistemiyle board veya workspace kapsamına alınmalı; type/tag/category ayrımı ürün içinde netleştirilmelidir.

Status değişimlerinde tekil satır ve bulk akışındaki not sözleşmesi birleştirilmeli; status history kullanıcıya ve admin audit ekranına açılmalıdır. “Follow” davranışı kullanıcıya açıkça gösterilmeli, post takipten çıkma ve bildirim türü bazlı tercih UI’ı eklenmelidir.

### P3 — Canny’nin ticari karar destek derinliği

Revenue score şu an `oy + 10×müşteri + (MRR + açık fırsat)/1000` şeklinde Feedl’e özgü basit bir formüldür. Bu, Canny benzeri bir başlangıçtır ancak generic scoring engine değildir. Impact/effort ağırlıkları, segment bazlı MRR/ARR, renewal risk, churned revenue, dealbreaker ve müşteri talebi raporları eklenmelidir. Analytics üç ayrı yüzeye ayrılmalıdır: Portal, Autopilot ve Ideas/Revenue.

### P4 — Gerçek entegrasyon ve geliştirici platformu

Öncelik sırası bir destek sistemi, bir mesajlaşma sistemi ve bir proje yönetim sistemi olacak şekilde belirlenmelidir. Önerilen başlangıç: Intercom veya Zendesk, Slack ve Jira/Linear. Sonra App Store/Google Play/G2 gibi review kaynakları ve Gong/CRM kaynakları gelmelidir. Her entegrasyon için OAuth/token secret yönetimi, incremental sync, webhook/polling, PII maskesi, duplicate idempotency ve bağlantı koparma akışı standartlaştırılmalıdır.

Public API; post create/update, vote, comment, user identify, tags, changelog ve webhook yönetimini versioned ve scope’lu şekilde sunmalıdır. Widget SDK için `identify`, board token, origin policy, theme/branding, event callbacks ve iframe postMessage sözleşmesi dokümante edilmelidir.

### P5 — Autopilot’u kaynak ve güvenlik seviyesiyle tamamla

Autopilot inbox’un mevcut duplicate önerisi korunmalı; buna kaynak bağlantıları, önerilen board/category/tag, spam önerisi, confidence açıklaması, manual/automated mod, audit log ve retry eklenmelidir. Harici connector’lardan gelen konuşmaların ve review’ların PII alanları filtrelenmeli; ürün knowledge hub ile prompt bağlamı tenant bazında ayrılmalıdır.

## 7. Sonraki sprint sırası

| Öncelik | Sprint hedefi | Neden önce? |
|---:|---|---|
| 1 | Workspace/board hazırlık migration’ı ve merkezi tenant scope helper’ı | Sonraki tüm özelliklerin yeniden yazılmasını önler. |
| 2 | Widget origin enforcement + shared rate limit + security audit | Public yüzeyler ve embed saldırı alanını azaltır. |
| 3 | Server-side pagination + test/CI altyapısı | 200 kayıt sınırı ve manuel doğrulama riskini kaldırır. |
| 4 | Comments/changelog polish: mentions, markdown, attachments, subscriptions | Canny’nin kullanıcı iletişimi ve release loop’unu tamamlar. |
| 5 | Generic custom fields + board-configurable categories | Admin triage esnekliğini artırır. |
| 6 | Full API/webhook event matrix | Entegrasyon geliştirmesini mümkün kılar. |
| 7 | İlk canlı connector: Intercom veya Zendesk | Autopilot’un Canny benzeri kaynak ingest değerini kanıtlar. |
| 8 | Workspace/board UI, private access, role matrix, custom domain | Gerçek SaaS ve çoklu müşteri ürünleşmesine geçiş sağlar. |
| 9 | Gelişmiş revenue/reporting ve scoring engine | Canny’den farklılaşacak karar destek katmanını kurar. |
| 10 | Billing/plan limitleri ve Resend/custom domain | Ticari kullanıma hazır hale getirir. |

## Sonuç

Feedl, önceki rapora göre **çekirdek Canny klonundan Canny’nin önemli bir bölümünü işlevsel olarak karşılayan gelişmiş bir feedback platformuna** dönüşmüş. En büyük ilerleme, planlanan özelliklerin büyük bölümünün şema, API, UI ve üretim doğrulamasıyla tamamlanmasıdır. Build/lint kontrollerinde gerileme görülmemiştir.

Bugünkü en önemli karar noktası şudur: **Yeni bir özellik eklemekten önce workspace/board tenant temelini mi kuracağız, yoksa tek workspace MVP’de biraz daha polish ve entegrasyon mu yapacağız?** Canny’ye gerçek SaaS paritesi hedefleniyorsa workspace/board artık ertelenmemeli; hızlı demo ve tek müşteri kullanım hedefleniyorsa güvenlik, test otomasyonu, pagination, markdown/changelog ve ilk entegrasyon önce tamamlanmalıdır.

## Referanslar

[1]: https://github.com/kogu1988/feedl/tree/32e22e2 "Feedl güncel GitHub commit’i"
[2]: https://github.com/kogu1988/feedl/blob/32e22e2/docs/plan.md "Feedl güncel sprint planı"
[3]: https://github.com/kogu1988/feedl/blob/32e22e2/lib/db/schema.ts "Feedl güncel Drizzle şeması"
[4]: https://github.com/kogu1988/feedl/blob/32e22e2/app/%28main%29/dashboard/page.tsx "Feedl güncel admin dashboard’u"
[5]: https://github.com/kogu1988/feedl/blob/32e22e2/app/%28main%29/portal/%5Bid%5D/page.tsx "Feedl güncel fikir detay sayfası"
[6]: https://github.com/kogu1988/feedl/blob/32e22e2/package.json "Feedl build/lint scriptleri"
[7]: https://help.canny.io/en/collections/325099-canny-features "Canny resmi özellik kataloğu"
[8]: https://help.canny.io/en/articles/8202451-autopilot "Canny Autopilot"
[9]: https://help.canny.io/en/articles/4195400-the-canny-api "Canny API ve webhook kapsamı"
[10]: https://help.canny.io/en/articles/12310866-options-for-implementing-canny "Canny portal, widget ve API uygulama seçenekleri"
[11]: https://help.canny.io/en/articles/5795311-comments "Canny comments"
[12]: https://help.canny.io/en/articles/6329585-customizing-fields "Canny custom fields"
