# Feedl–Canny Fonksiyonel Parite Analizi

> **⚠️ Güncellik notu (2026-09-02):** Bu raporun §1 "mevcut durum"
> satırları Sprint 10+ öncesi bir repo anlık görüntüsüne göre yazılmıştır.
> Fikir detay sayfası, yorumlar + iç notlar (Sprint 10), merge/unmerge
> (Sprint 20), etiket + post tipi (Sprint 21), admin filtreleri
> (Sprint 12) ve CSV export (Sprint 7) artık mevcuttur. Güncel satır
> satır sınıflandırma için plan.md "Faz 3" bölümündeki **"Analiz
> gözden geçirmesi"** başlığına, kabul kriterleri için §6'ya bakınız.
> Bu rapor, plan.md Faz 3 (Sprint 20–34) yol haritasının kaynak
> dokümanıdır ve referans olarak korunmaktadır.

## Yönetici özeti

**Feedl, Canny’nin çekirdek “müşteri geri bildirimi → oylama → roadmap → yayın bildirimi” döngüsünü kurmuş durumda; ancak Canny ile birebir işlevsel parite için henüz erken aşamada.** Feedl’in mevcut reposu tek portal/tek çalışma alanı mantığında çalışan bir MVP’dir. Canny ise çoklu board, ayrıntılı post/idea yönetimi, yorum ve ekip işbirliği, müşteri/gelir bağlamı, iç roadmap ve raporlama, entegrasyonlar, widget/SDK/SSO, API/webhook ekosistemi ve kaynaklardan otomatik feedback çıkaran daha geniş bir platformdur. [1] [2]

“Birebir aynı” hedefi iki farklı anlama gelebilir. **Fonksiyonel parite**, Canny’deki temel kullanıcı ve admin iş akışlarının Feedl’de karşılanmasıdır ve gerçekçi bir hedeftir. Buna karşılık Canny’nin marka, görsel tasarım, özel algoritmaları, ticari plan kısıtları, entegrasyon derinliği ve kapalı kaynak iç uygulamalarıyla kelimesi kelimesine aynı olmak mümkün veya gerekli değildir. Aşağıdaki plan, marka/asset kopyalamadan **aynı ürün kategorisindeki işlevsel sonucu** elde etmeyi hedefler.

## 1. Mevcut Feedl’in Canny karşısındaki konumu

| Alan | Feedl’deki durum | Parite değerlendirmesi |
|---|---|---|
| Public feedback portalı | Portal, fikir listesi, arama, yeni fikir formu mevcut. | Çekirdek parite var; ayrıntılı post sayfası ve board yapısı eksik. |
| Upvote | Kullanıcı başına tek oy, oy geri alma ve sayaç mevcut. | Temel parite var; oy önceliği, başkası adına oy ve müşteri/gelir bağlamı eksik. |
| Status/roadmap | `open`, `planned`, `in-progress`, `shipped`; public kanban mevcut. | Basit parite var; Canny’nin özelleştirilebilir public status’leri ve ayrı internal roadmap’i eksik. |
| Changelog | `shipped` fikirleri portalda ayrı “Yayında” bölümünde gösteriliyor. | Kısmi parite; bağımsız changelog entry, markdown, görsel, label, post-link ve abonelik eksik. |
| Duplicate/AI | Embedding + cosine aday araması + LLM doğrulaması; özet, sentiment ve keyword mevcut. | Temel AI paritesi var; Canny Autopilot’un kaynak ingest’i, inbox/audit log’u, spam, smart reply ve comment summary eksik. |
| Comments | Veri modeli ve UI yok; proje planında sonraki faza bırakılmış. | Kritik eksik. Public/internal/private yorum ve bildirimler eklenmeli. |
| Board/workspace | Tek global `posts` listesi; `boardId`/organization modeli yok. | En büyük mimari eksik; çoklu müşteri ve tenant izolasyonu gerekiyor. |
| Admin triage | Admin tablo, status dropdown ve CSV export var. | Basit parite; filtre/saved view, bulk edit, owner, custom fields, tag/category, merge ve detaylı triage eksik. |
| Analytics/reporting | CSV export var; dashboard raporları yok. | Büyük eksik. Canny’de Ideas, Autopilot ve Portal raporları bulunuyor. |
| Entegrasyon | Clerk, Neon, Inngest, OpenRouter ve Resend/Ethereal var. | Canny’nin CRM/support/review/PM entegrasyonları, API/webhooks ve widget/SDK eksik. |
| Kimlik doğrulama | Clerk oturum açma; admin rolü DB’den kontrol ediliyor. | Uygulama içi auth var; müşteri uygulamasına gömülü Identify/SSO akışı eksik. |
| Ürünleştirme | Vercel üzerinde tek ürün/portal yaklaşımı. | SaaS paritesi için organization, billing, plan limitleri ve tenant onboarding gerekiyor. |

Feedl’in mevcut kodu; portal, oylama, dört durumlu workflow, public roadmap, AI analiz, duplicate tespiti, shipped e-postaları ve CSV export gibi Canny’nin çekirdek fikrini karşılayan parçaları içeriyor. Bununla birlikte veri modeli yalnızca `users`, `posts` ve `votes` tablolarına dayanıyor; Canny’nin board, company, opportunity, custom field, comment, tag, integration ve internal planning katmanları henüz yok. [3] [4]

## 2. Canny’nin referans alınması gereken ürün yüzeyi

Canny’nin resmi özellik kataloğu, ürünün yalnızca public voting board olmadığını gösteriyor. Özellikler; boards ve erişim seçenekleri, public roadmap ve changelog, post/idea yönetimi, public/internal yorumlar, post merge, custom fields, owner ve ETA, filtreler ve kayıtlı görünümler, voter listesi, şirket ve fırsat bağlamı, iç roadmap/scoring, raporlar, Autopilot, otomasyonlar, segmentasyon, bildirimler, tag/category yönetimi, API ve SSO başlıklarında toplanıyor. [1]

Canny’nin güncel public roadmap dokümanında kullanıcıya gösterilen statüler varsayılan olarak **Open, Under Review, Planned, In Progress, Complete ve Closed** şeklinde tanımlanıyor; public roadmap’te tam olarak seçilen kolonlar gösteriliyor. Ayrıca status değişikliği roadmap sıralamasını ve e-posta bildirimlerini etkiliyor. Feedl’in mevcut dört statüsü bu yaşam döngüsünün sadeleştirilmiş bir alt kümesi. [5] [6]

Canny’nin changelog’u roadmap’ten ayrı bir içerik alanı olarak çalışıyor. Bir changelog entry’si markdown ve görsel destekleyebiliyor, birden fazla post ile ilişkilendirilebiliyor, label’larla filtrelenebiliyor ve widget üzerinden ürüne gömülebiliyor. Feedl’deki mevcut “Yayında” bölümü bu sonucu kısmen taklit ediyor; ancak bağımsız yayın içeriği ve post-entry ilişki modeli bulunmuyor. [7]

## 3. Yapılmış olanlar: Feedl’in güçlü başlangıç noktası

Feedl’in mevcut reposunda önce korunması gereken çekirdek şu parçalardır. Kullanıcı portalı public okunabilir; giriş yapan kullanıcı fikir gönderebilir ve oy verebilir. Yeni fikir formu Zod ile başlık/açıklama uzunluklarını doğrular ve başlık yazılırken benzer fikir önerir. Bu, Canny’deki duplicate önleme deneyiminin sade bir karşılığıdır. [8] [9]

Oy modeli veritabanı seviyesinde `(user_id, post_id)` unique kısıtı ile tekil tutulur. Admin, fikrin durumunu değiştirir; durum değişiminden sonra `shipped` geçişi yazar ve oy verenler için e-posta iş akışını tetikler. Bu çekirdek “kullanıcı talep etti, topluluk destekledi, ekip ilerletti, ürün yayınlandı, kullanıcıya haber verildi” döngüsü doğru ürün omurgasıdır. [10] [11]

AI tarafında Feedl, yeni postu embedding’e çevirip cosine benzerliğiyle aday arıyor, sonra LLM ile `DUPLICATE`, `RELATED` veya `UNRELATED` kararı veriyor. Ayrıca özet, sentiment ve keyword üretiyor. Bu, Canny’nin Autopilot yaklaşımına yön olarak yakındır; fakat Canny’nin güncel Autopilot’u harici destek/satış/review kaynaklarını dinleme, duplicate merge, spam tespiti, Smart Replies, comment summaries, manuel inbox ve audit log gibi operasyonel yetenekleri de kapsıyor. [12]

## 4. Yapılması gerekenler: önceliklendirilmiş yol haritası

### P0 — Mimari temeli değiştirmeden önce yapılması gerekenler

#### P0.1. “Workspace/Organization + Board” veri modeline geçiş

En kritik iş, `posts` tablosunu global olmaktan çıkarıp en azından `workspaceId` ve `boardId` ile kapsamlandırmaktır. Canny’de farklı feedback koleksiyonları boards üzerinden ayrılır ve kullanıcıların board erişimleri yönetilebilir. Feedl’in mevcut tek portalı yerine her müşteri/çalışma alanının kendi portalı, board’ları ve ayarları olmalıdır. [1] [13]

Önerilen çekirdek tablolar `workspaces`, `workspace_members`, `boards`, `board_members` veya board erişim kuralları, `board_statuses`, `posts`, `votes` ve `users` şeklindedir. Mevcut `posts.userId` alanı korunmalı; buna `workspaceId` ve `boardId` eklenmelidir. Her sorgu tenant kapsamını zorunlu olarak taşımalı; yalnızca uygulama seviyesinde değil, mümkünse PostgreSQL RLS veya eşdeğer merkezi query helper’larıyla izolasyon garanti edilmelidir.

Bu çalışma yapılmadan comments, tags, integrations veya billing eklemek risklidir; çünkü sonradan bütün tabloların tenant anahtarıyla yeniden düzenlenmesi gerekir. İlk migration stratejisi mevcut tek portalı varsayılan bir workspace ve varsayılan board içine taşımak, daha sonra yeni workspace açılışını etkinleştirmek olmalıdır.

#### P0.2. Board erişim politikaları ve kullanıcı segmentleri

Public, private, authenticated-only ve belirli workspace/board üyelerine açık erişim seçenekleri eklenmelidir. Anonymous board desteği isteniyorsa anonim gönderi/oy akışında spam, rate limit, cihaz/IP abuse ve sonradan kullanıcı eşleştirme kuralları tasarlanmalıdır. Canny’nin resmi ürününde public/private board ve kullanıcı tanımlama seçenekleri bulunur. [1] [14]

#### P0.3. Fikir detay sayfası

Feedl şu anda esas olarak kart listesi gösteriyor. Canny paritesinde her post için kalıcı bir detay URL’si, tam açıklama, oy durumu, yorumlar, status geçmişi, bağlı changelog, duplicate/merged bilgisi, admin notları ve ilgili kullanıcı/şirket bağlamı gerekir. Bu sayfa, sonraki tüm özelliklerin birleşeceği kanonik kaynak olmalıdır.

### P1 — Çekirdek Canny deneyimini tamamlayan işlevler

#### P1.1. Public, internal ve private comments

`comments` tablosu; `postId`, `authorId`, `body`, `visibility`, `parentCommentId`, `createdAt`, `updatedAt` ve silinme/moderasyon alanlarıyla kurulmalıdır. `visibility` en az `public`, `internal` ve board ayarına bağlı `private` davranışını desteklemelidir. Threaded reply, markdown, mention, edit/delete, admin etiketi ve e-posta bildirimleri eklenmelidir. Canny’de public yorumlar son kullanıcılar ve adminler arasında görünür; internal yorumlar yalnızca ekip içindir; admin yorumu ilgili yazar ve oy verenlere bildirim gönderebilir. [15]

#### P1.2. Post merge/unmerge ve oy/yorum taşıma

Mevcut Feedl AI katmanı duplicate’i işaretliyor, fakat Canny’deki gibi operasyonel bir **merge** işlemi yok. Admin bir postu başka bir postla birleştirebilmeli; kaynak post arşivlenmeli veya `mergedIntoId` ile hedefe bağlanmalı; oylar, yorumlar, takipçiler ve mümkünse AI içgörüleri hedef postta konsolide edilmelidir. İşlem audit log’a yazılmalı ve geri alınabilir bir unmerge stratejisi bulunmalıdır. Canny, merge sırasında yorum ve oyların kalan posta taşındığını ve merge edilen postun yorumlarda göründüğünü açıkça tanımlar. [16]

#### P1.3. Zengin post alanları

Canny’nin custom field yaklaşımına yaklaşmak için `custom_field_definitions`, `custom_field_values`, `tags`, `categories`, `post_tags`, `post_owner`, `eta` ve `post_type` modelleri eklenmelidir. İlk sürümde feature request, bug report ve usability issue türleri; owner, target date, effort, impact ve dropdown alanları yeterlidir. Daha sonra Fibonacci, score/formula ve şirket MRR gibi gelişmiş alanlar eklenebilir. Canny custom fields’i yalnızca görünen form alanı olarak değil, filtreleme, sıralama ve scoring altyapısı olarak kullanır. [17]

#### P1.4. Filtreler, sıralama, saved views ve bulk actions

Admin ekranı tek tablo olmaktan çıkarılmalı; board, status, tag, category, owner, post type, oy sayısı, tarih, sentiment, duplicate ve custom field’lara göre filtrelenebilmelidir. Filtre kombinasyonları kaydedilip paylaşılabilmeli; toplu status/tag/owner değişikliği, toplu arşivleme ve toplu merge aksiyonları eklenmelidir. Pagination, server-side sorting, cursor/offset stratejisi ve büyük board’lar için indeksler de bu aşamada yapılmalıdır.

#### P1.5. Gelişmiş status yaşam döngüsü

Feedl’in dört sabit status’u board bazlı ve yapılandırılabilir hale getirilmelidir. Canny’nin public status’lerine karşılık olarak `open`, `under-review`, `planned`, `in-progress`, `complete` ve `closed` gibi durumlar desteklenmeli; her board hangi üç veya daha fazla status’u public roadmap’te göstereceğini seçebilmelidir. Status değişiminde açıklama/yorum eklenebilmeli, status history tutulmalı ve bildirim şablonu bu açıklamayı içermelidir. [5] [6]

### P2 — Roadmap, changelog ve iç ürün yönetimi

#### P2.1. Bağımsız changelog sistemi

`changelog_entries` ve `changelog_post_links` tabloları eklenmelidir. Entry başlığı, slug, markdown gövde, kapak/ek görseller, label’lar, yayın tarihi, author, visibility ve published state içermelidir. Admin bir veya birden fazla fikri changelog entry’sine bağlayabilmeli; fikir sayfası ilişkili release note’a, changelog entry’si de ilgili fikirlere gidebilmelidir. Public changelog ayrıca ayrı route, arama, label filtresi, pagination ve e-posta aboneliği sunmalıdır. Canny’nin changelog dokümanı markdown, görsel, label, post-link ve widget işlevlerini tanımlar. [7]

#### P2.2. Internal roadmap ve scoring

Public roadmap ile adminin karar verdiği internal roadmap ayrılmalıdır. Internal roadmap; swimlane/quarter, owner, target date, effort, impact, confidence, revenue impact ve score alanlarına sahip olmalıdır. İlk aşamada RICE veya weighted score hesaplama yeterlidir. Public roadmap yalnızca yayınlanmak istenen üç kolonu gösterirken ekip içi roadmap daha zengin planlama bilgisi taşımalıdır. Canny’nin resmi raporlama ve roadmap belgelerinde internal roadmap/scoring ayrı bir ürün yüzeyi olarak yer alır. [1] [18]

#### P2.3. Bildirim merkezi ve abonelikler

Yalnızca `shipped` e-postası yeterli değildir. Kullanıcılar post takip edebilmeli; yeni yorum, admin cevabı, status değişikliği, merge, changelog yayını ve mention olayları için tercihlerini yönetebilmelidir. `notifications`, `notification_preferences`, `post_followers` ve `email_deliveries` tabloları gerekir. E-posta gönderimi idempotency key, retry, bounce/complaint takibi ve unsubscribe mekanizmasıyla production seviyesine çıkarılmalıdır.

### P3 — Canny’nin müşteri ve gelir bağlamı

#### P3.1. Company, segment ve user profile modeli

Canny’nin fark yaratan taraflarından biri, fikri yalnızca oy sayısıyla değil, fikri isteyen müşterinin hesabı ve ticari değeriyle değerlendirmesidir. Feedl’e `companies`, `company_members`, `user_segments`, `company_fields` ve profile metadata eklenmelidir. MRR/ARR, renewal date, renewal risk, customer status ve account owner gibi alanlar fikirle ilişkilendirilebilmelidir. Canny custom fields dokümanında company fields’in CRM/SDK verisiyle doldurulabildiği ve raporlama için kullanıldığı belirtilmektedir. [17]

#### P3.2. Opportunities ve revenue-weighted prioritization

`opportunities` ve `post_opportunities` modeliyle satış fırsatı, deal değeri, aşama, kapanış tarihi ve ilgili şirket/idea ilişkilendirilmelidir. Oy sayısının yanında “kaç müşteri istiyor, toplam MRR ne, açık fırsat geliri ne, churn riski ne” soruları cevaplanmalıdır. Bu veri, customer requests, sales pipeline, churned revenue ve dealbreaker benzeri raporların temelini oluşturur. [19]

### P4 — Entegrasyon, gömülü kullanım ve geliştirici platformu

#### P4.1. Widget ve Identify/SSO

Canny’nin resmi uygulama seçenekleri; portal linki, uygulama içine gömülü widget ve API ile özel UI olarak üç model sunuyor. Feedl için minimum parite, müşterinin kendi ürününde `<script>` veya web component ile feedback portalı/widget’ını açabilmesidir. Widget board seçebilmeli, arama, post oluşturma ve oy verme işlemlerini desteklemelidir. [20]

Güvenli gömülü kullanım için server-side imzalı kısa ömürlü JWT, `identify` endpoint’i, audience/issuer kontrolü, token expiration, origin allowlist ve tenant/board yetkisi gerekir. Canny’nin SSO dokümanı widget kimlik doğrulamasında sunucuda token üretme ve doğrulama adımlarını belirtir. [21]

#### P4.2. Public API, webhooks ve SDK

API; boards, users, posts, comments, votes, statuses, tags, categories, changelog, companies, opportunities ve integrations için CRUD veya güvenli okunabilir/yazılabilir operasyonlar sunmalıdır. Webhook olayları en az `post.created`, `post.updated`, `post.deleted`, `post.status_changed`, `comment.created`, `vote.created`, `vote.deleted` ve `changelog.published` olmalıdır. API key’leri workspace bazlı, scope’lu, hash’lenmiş ve rotate edilebilir tutulmalı; rate limit, pagination, idempotency ve webhook signature uygulanmalıdır. Canny’nin resmi API kapsamı bu nesnelerin önemli bölümünü ve webhook olaylarını içerir. [22]

#### P4.3. Product/support/sales entegrasyonları

Canny’nin Autopilot kaynakları ve entegrasyon yaklaşımına yaklaşmak için ilk entegrasyon sırası Intercom/Zendesk/Help Scout benzeri destek sistemleri, Slack, Gong veya satış konuşmaları, App Store/Google Play/G2 gibi review kaynakları, ardından Jira/Linear/GitHub/ClickUp gibi geliştirme araçları olmalıdır. Her connector için OAuth/token yönetimi, incremental sync, webhook/polling, deduplication, PII redaction, retry/dead-letter ve bağlantı kesme akışı gerekir. Canny Autopilot’un harici kaynaklardan feedback çıkarma, duplicate merge ve spam işleme yetenekleri bu alanın yalnızca basit import olmadığını gösterir. [12]

### P5 — AI Autopilot paritesi

Feedl’in mevcut AI’ı post oluşturulduktan sonra özet, keyword, sentiment ve duplicate adayını işler. Canny paritesine yaklaşmak için bunun üzerine bir **Autopilot inbox** kurulmalıdır. Inbox her AI önerisini kaynak, güven skoru, önerilen board/category, duplicate hedefi, spam kararı ve önerilen aksiyonla göstermeli; admin approve, reject, edit, merge, ignore ve retry yapabilmelidir. Otomatik modda yapılan bütün işlemler audit log olarak görülebilmelidir. Canny’nin resmi Autopilot dokümanı manuel öneri/inbox ve otomatik aksiyon/audit log ayrımını, duplicate, spam, Smart Replies ve comment summaries kapsamını açıklıyor. [12]

AI paritesinin ikinci kısmı context/knowledge katmanıdır. Workspace bazında ürün dokümantasyonu, kategori sözlüğü, mevcut roadmap, bilinen duplicate’ler ve hassas veri kuralları tanımlanmalı; retrieval destekli prompt’larla board seçimi, konu/tema çıkarımı, spam sınıflandırması ve özet üretimi yapılmalıdır. Model çıktıları Zod ile doğrulanmaya devam etmeli; prompt injection, PII redaction, kullanıcı içeriğinin model sağlayıcısında saklanması ve tenant verilerinin birbirine karışmaması ayrıca ele alınmalıdır.

## 5. Mimari dönüşüm önerisi

Mevcut Feedl mimarisi Next.js + Clerk + Neon/Drizzle + Inngest + OpenRouter olarak iyi bir MVP tabanıdır; ancak Canny seviyesinde çok kiracılı bir ürün için aşağıdaki sınırlar netleştirilmelidir:

| Mimari alan | Mevcut yaklaşım | Gerekli hedef |
|---|---|---|
| Tenant | Global kullanıcı/post tabloları | Workspace/organization sınırı ve her sorguda tenant scope |
| Board | Tek portal | Workspace başına çoklu board, board access policy |
| Auth | Clerk session + DB role | End-user Identify/SSO, workspace üyeleri, admin rollerinin ayrıştırılması |
| İşlem | Fikir ve oy API’leri | Domain service katmanı, idempotency, audit log, event outbox |
| Event | Inngest event gönderimi | Outbox/retry/dead-letter, webhook delivery ve event versioning |
| AI | Yeni post sonrası tek otomasyon | Kaynak ingest + inbox + audit log + configurable automation |
| Arama | `ILIKE`, limitli sonuç | Full-text + trigram; büyük hacimde vector/hybrid search |
| DB | 3 ana tablo | Comments, boards, fields, tags, companies, opportunities, integrations, notifications vb. |
| Admin | Tek tablo + status dropdown | Saved views, bulk actions, custom fields, reporting, internal roadmap |
| UI | Portal kartları | Post detail, public/internal views, embedded widget, responsive tenant branding |
| Operasyon | Env tabanlı email | Delivery tracking, unsubscribe, bounce, rate limit, observability |

Özellikle `posts` tablosuna sonradan `boardId` eklemek yerine tenant migration’ı erken yapmak gerekir. Her yeni tablo için `workspaceId` eklemek, erişim kontrolünü merkezi helper ile zorunlu kılmak, admin ve end-user permission’larını ayrı tanımlamak ve post/idea ayrımını ürün dili olarak netleştirmek uzun vadeli teknik borcu azaltır.

## 6. Uygulama sırası ve kabul kriterleri

| Sıra | Teslimat | Kabul kriteri |
|---:|---|---|
| 1 | Workspace + board + erişim modeli | İki workspace birbirinin post, oy, kullanıcı ve admin verisini göremez; tek tenant mevcut verisi kaybolmadan migrate olur. |
| 2 | Post detail + comments | Public/internal yorum, reply, mention, bildirim ve permission testleri çalışır. |
| 3 | Merge + audit log | Oy/yorumlar hedefe taşınır; kaynak postun durumu ve geçmişi açıklanır; işlem gerektiğinde geri alınabilir. |
| 4 | Custom fields/tags/categories/owners/ETA | Admin filtreleyebilir, sıralayabilir, saved view oluşturabilir ve bulk update yapabilir. |
| 5 | Configurable statuses + status history | Board bazlı status’ler ve public roadmap kolonları ayarlanabilir; status update e-postası açıklama içerir. |
| 6 | Changelog | Markdown/görsel/label, post link, ayrı public sayfa, filtre ve abonelik tamamlanır. |
| 7 | Internal roadmap/scoring | Ekip içi roadmap, owner, tarih, effort/impact ve score ile karar destekler; public görünümden ayrıdır. |
| 8 | Company/segment/opportunity | İstekler müşteri, segment, MRR/ARR ve fırsatlarla ilişkilendirilir; revenue-weighted rapor oluşur. |
| 9 | Widget + Identify/SSO | Demo müşteri uygulamasında ek login olmadan güvenli feedback gönderme ve board erişimi çalışır. |
| 10 | API/webhooks/SDK | Dokümante edilmiş, scoped, rate-limited API; imzalı webhook; idempotent tüketim örneği bulunur. |
| 11 | Integrations + Autopilot inbox | En az bir support ve bir PM entegrasyonu; approve/reject/merge/spam akışı ve audit log çalışır. |
| 12 | Reporting + operations | Ideas/Portal/Autopilot metrikleri, drill-down, export, logs, monitoring, backup ve abuse controls tamamlanır. |

## 7. En kısa gerçekçi yol: “Canny Lite” ve “Canny Parity” ayrımı

Eğer hedef kısa sürede pazara çıkmaksa, bütün Canny özelliklerini aynı anda geliştirmek yerine iki ayrı ürün hedefi tanımlanmalıdır. **Canny Lite** için workspace/board, post detail, comments, configurable statuses, merge, tags/custom fields, bağımsız changelog, filters/saved views ve temel API/widget yeterlidir. Bu, Feedl’in bugün sahip olduğu çekirdeği gerçek bir ekip kullanımına yaklaştırır.

**Canny Parity** için buna company/revenue/opportunity bağlamı, internal roadmap/scoring, reporting, support/review/sales integrations, Autopilot inbox/audit log, spam, Smart Replies/comment summaries, Identify/SSO, güçlü public API/webhooks, tenant billing ve enterprise security eklenmelidir. Canny’nin güncel resmi özellik kataloğunda bulunan işlevler bu ikinci seviyeye karşılık gelir. [1] [12] [19] [22]

## Sonuç

Feedl’in Canny’ye yaklaşması için yapılacak ilk iş yeni bir UI eklemek değil, **tek portal veri modelini çok kiracılı workspace + board modeline dönüştürmektir**. Ardından post detail/comments/merge ve zengin admin triage özellikleri gelmelidir. Roadmap ve changelog birbirinden ayrılmalı; sonrasında müşteri/gelir bağlamı, widget/SSO/API ve harici kaynaklardan AI feedback ingest’i eklenmelidir.

Önerilen öncelik sırası şudur: **tenant/board temeli → post detail ve yorumlar → merge ve triage → custom fields/tags/status history → changelog/internal roadmap → şirket/gelir/risk verisi → widget/SSO/API → entegrasyonlar ve Autopilot inbox → reporting, billing ve enterprise operasyonları**. Bu sıra izlenirse mevcut Feedl yatırımı korunur ve sonradan büyük bir yeniden yazım riski azaltılır.

## Referanslar

[1]: https://help.canny.io/en/collections/325099-canny-features "Canny Features — resmi özellik kataloğu"
[2]: https://canny.io/ "Canny resmi ana sayfası"
[3]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/lib/db/schema.ts "Feedl veritabanı şeması"
[4]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/docs/plan.md "Feedl sprint planı ve ürün kapsamı"
[5]: https://help.canny.io/en/articles/673583-post-statuses "Canny post statuses"
[6]: https://help.canny.io/en/articles/3828148-public-roadmap "Canny public roadmap"
[7]: https://help.canny.io/en/articles/3006399-changelog "Canny changelog"
[8]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/app/portal/page.tsx "Feedl portalı"
[9]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/components/custom/new-post-dialog.tsx "Feedl yeni fikir formu ve benzer öneriler"
[10]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/app/api/votes/route.ts "Feedl oy API’si"
[11]: https://github.com/kogu1988/feedl/blob/51d10f27bf05401629f843c62cdb4fb55a14853d/app/api/admin/posts/route.ts "Feedl admin status API’si"
[12]: https://help.canny.io/en/articles/8202451-autopilot "Canny Autopilot"
[13]: https://help.canny.io/en/collections/2225027-boards "Canny Boards"
[14]: https://help.canny.io/en/articles/9829559-custom-access-boards "Canny custom access boards"
[15]: https://help.canny.io/en/articles/5795311-comments "Canny comments"
[16]: https://help.canny.io/en/articles/5776649-merging-and-unmerging-posts "Canny merging and unmerging posts"
[17]: https://help.canny.io/en/articles/6329585-customizing-fields "Canny custom fields"
[18]: https://help.canny.io/en/articles/4999644-internal-roadmap "Canny internal roadmap"
[19]: https://help.canny.io/en/articles/8737133-canny-reporting "Canny reporting"
[20]: https://help.canny.io/en/articles/12310866-options-for-implementing-canny "Canny implementation options: portal, widget, API"
[21]: https://help.canny.io/en/articles/489272-single-sign-on-sso "Canny SSO"
[22]: https://help.canny.io/en/articles/4195400-the-canny-api "Canny API ve webhook olayları"
