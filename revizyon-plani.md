# feedl — Revizyon Planı

> **Tarih:** 6 Eylül 2026 · **Baz commit:** `3bd368b`
> **Kapsam:** Frontend (tasarım/kurumsal kimlik/token/AI-slop) + Backend
> (optimizasyon/güvenlik/spaghetti/AI-slop/hız) + çapraz/operasyonel riskler +
> önceliklendirilmiş aksiyonlar.
> **Kaynak:** Kod taraması (`app/`, `components/`, `lib/`, `inngest/`,
> `migrations/`, `tests/`), `DESIGN.md`, `docs/standarts.md`, `docs/plan.md`.

---

## 0. Özet

Feedl, **teknik olarak satışa hazır** bir ürün konumunda. Güçlü yanlar:
sıfır `any` (katı TypeScript), tutarlı `{success, data/error}` envelope,
kapsamlı rate-limiting, tenant izolasyonu, hash'li/şifreli secret yönetimi,
token disiplinli + tek-kaynak frontend, AI-slop belirtisi yok, commit'lenmiş
gizli anahtar yok.

Kalan iş **özellik değil, üretim hijyeni**: gözlemlenebilirlik, FK index,
test kapsamı, marka aksanı ve birkaç DRY/operasyonel borç.

---

## 1. Frontend Revizyonları

| # | Konu | Mevcut durum | Sorun | Çözüm | Öncelik | Efor |
|---|---|---|---|---|---|---|
| F1 | `textOn()` DRY | `site-header.tsx` + `site-footer.tsx` birebir kopya | Bakım riski; 3. kopya eklenirse sapma | `lib/color.ts` (veya `lib/wcag.ts`) tek kaynak; ikisi oradan import | P1 | Çok düşük |
| F2 | Canonical URL | `canonical-link.tsx` client-side `<link>` enjekte | SEO için iş görür ama Google server-render'ı tercih eder | `(main)/layout.tsx` `generateMetadata` + `metadata.alternates.canonical` (host/path server'da çözülür) | P2 | Düşük-orta |
| F3 | Workspace marka rengi | `brandColor` sadece logo karosu | "Kendi marka rengin" vaadi tam değil | CSS değişkeniyle (`--brand` override) portal aksanı: oy/buton/odak workspace'e göre renklenir (AA kontrast korunur) | P2 | Orta |
| F4 | Native `<select>` tutarlılığı | Global CSS (`globals.css`) tema çözdü | Kapalı alan class'ları hâlâ tutarsız (`bg-transparent` vs `bg-background` vs `bg-muted/40`) | Ortak `Select` primitive (veya tek `selectClassName`) + tüm kullanımlara uygula | P2 | Orta |
| F5 | Component yakınlığı | 70 custom component; `CommentCard` vs `IdeaCard` | İkiz/yarı-ikiz riski | Ortak kabuk çıkar (kart/oy/rozet/badge) — gereksiz varyantları tekilleştir | P3 | Orta |
| F6 | Erişilebilirlik audit | `aria`/`sr-only` kısmen | Sistematik denetim yok | Axe/manuel pass; form label, odak sırası, klavye nav | P3 | Orta |
| F7 | `.env.example` | Gitignored (repoda yok) | Yeni env'ler (`ENCRYPTION_KEY`, `RESEND_WEBHOOK_SECRET`) dokümante değil | Boş değerli `.env.example`'ı commit et (gizli yok) | P1 | Çok düşük |

---

## 2. Backend Revizyonları

| # | Konu | Mevcut durum | Sorun | Çözüm | Öncelik | Efor |
|---|---|---|---|---|---|---|
| B1 | Gözlemlenebilirlik | Sadece `console.error` | Üretim hatası kök nedeni görünmez | **Sentry** (Next.js SDK) + `lib/logger` (yapısal log + seviye) | P0 | Düşük |
| B2 | FK index denetimi | FK kolonlarına açık index migration'ı belirsiz | Postgres FK'ye otomatik index OLUŞTURMAZ → sessiz yavaşlama | `posts.workspace_id`, `votes.post_id/user_id`, `comments.post_id`, `post_followers.post_id`, `post_tags.post_id/tag_id`, `email_deliveries.provider_id` (✅ var) audit + eksikleri migration | P0 | Düşük |
| B3 | Test kapsamı | 64 birim test; E2E yok | Widget/merge/email/webhook uçtan uca test edilmiyor | **Playwright** smoke: widget JWT, merge/unmerge, Resend+Paddle webhook → DB | P1 | Orta |
| B4 | AI fallback | `minimax-m3:free` tek model | Flaky/429 → autopilot/triage kesinti | `LLM_MODEL` fallback zinciri (gemini-2.5-flash ücretli) + env flag | P1 | Çok düşük |
| B5 | Embedding ölçek | 2048-dim pgvector, HNSW yok | O(n) tarama; hacimde yavaş | `halfvec` + HNSW (dim ≤2000) veya ayrı embedding store; eşik değerleri yeniden kalibre | P3 | Yüksek |
| B6 | `lib/post-search.ts` bakımı | SQL+JS fold ikiz eşleme | `TR_FOLD` senkron riski; 4-aşamalı hybrid zor | Fold eşlemeyi tek kaynağa çek + test sayısını artır; aşama dokümanı | P2 | Orta |
| B7 | `lib/db/schema.ts` | 1106 satır tek dosya | Okunabilirlik/ölçek | Domain bazlı böl (`auth`, `posts`, `feedback`, `billing`...); breaking olmadan re-export | P3 | Orta |
| B8 | `getWorkspaceId` cache | Module-level `cached` | Kod kokusu (serverless'ta güvenli ama kırılgan) | `React.cache()` / per-request AsyncLocalStorage | P3 | Düşük |
| B9 | Dependabot | 3 vuln (non-runtime) | Security sekmesinde görünür | `@clerk/ui` upgrade veya bırak + shadcn temasını inline; ignore config zaten var | P2 | Orta |
| B10 | Email changelog korrelasyonu | Anonim aboneler `email_deliveries`'e girmez | Deliverability kartı changelog mail'ini saymaz | `changelog_subscribers` için ayrı `email_deliveries` (nullable user) veya ayrı tablo | P3 | Orta |

---

## 3. Çapraz / Operasyonel Riskler

| Risk | Detay | Aksiyon |
|---|---|---|
| Vercel deploy limiti (~100/24h) | Sık iterasyonda kuyruk birikir | "Tek push = tek deploy" kuralı korunur; kritik revizyonlar tek batch |
| Upstash free tier (10GB/ay) | Rate-limit store trafiği | Kota uyarısı + limit log/izleme |
| Paddle sandbox paylaşımlı | Başka proje verisiyle karışma | `feedl_` öneki disiplini; canlı geçiş Paddle-dashboard işi |
| AI ücretsiz model maliyet/kararlılık | OpenRouter free modeli retrain edebilir + flaky | B4 fallback + bütçe/izleme |
| OpenRouter embedding free | Veri eğitimde kullanılabilir (free-tier) | Üretimde ücretli/özel embedding'e geçiş değerlendirmesi |
| Resend `provider_id` korrelasyonu | `batch.create` id sırası best-effort | B3 testle doğrula; gerekirse `emails.send` döngüsüne geç |
| E-posta gönderen itibarı | Bounce/complaint >%2-5 riskli | 63v deliverability kartı + auto-suppress (✅); oran izleme |

---

## 4. Önceliklendirilmiş Aksiyon Planı

### Faz 0 — Hızlı kazanımlar (tek sprint, düşük efor, yüksek değer)
1. **B1** Sentry + `lib/logger`.
2. **B2** FK index audit + eksik migration.
3. **F1** `textOn()` → `lib/color.ts`.
4. **B4** AI fallback zinciri.
5. **F7** `.env.example` commit.

### Faz 1 — Üretim sağlamlığı
6. **B3** Playwright E2E smoke (widget, merge, Resend/Paddle webhook).
7. **F2** Canonical → server-side `generateMetadata`.
8. **B9** Dependabot kalıcı çözüm (`@clerk/ui`).

### Faz 2 — Farklılaşma / kimlik
9. **F3** Workspace marka rengini gerçek aksana bağla.
10. **F4** `<select>` tek `Select` primitive.
11. **B6** `post-search` fold tekilleştirme + test.

### Faz 3 — Ölçek / temizlik
12. **B5** Embedding HNSW/halfvec.
13. **B7** `schema.ts` böl.
14. **F5** Component yakınlaştırma.
15. **B8** `getWorkspaceId` per-request cache.
16. **F6** Erişilebilirlik audit.
17. **B10** Changelog email korrelasyonu.

---

## 5. Kabul Kriterleri (her revizyon için)

- `npm run build` + `npm run lint` (0) + `npm test` yeşil.
- Türkçe UI metinleri ve `{success,data/error}` envelope korunur.
- Tasarım değişikliği `DESIGN.md`'e işlenir; şema değişikliği
  `drizzle-kit generate` + `migrate` commit'ten önce çalışır.
- Her batch tek commit + tek push (Vercel deploy limiti kuralı).

---

## 6. Kapsam Dışı / Ertelenen

- **Canny importer ileri** (oy/yorum import, Canny API, "Move from Canny") — ayrı sprint.
- **Billing canlı geçiş** — Paddle dashboard işi (kod hazır, sandbox korunur).
- **pg_trgm** — tamam (migration 0043).
- **E-posta deliverability** — tamam (63v: Resend webhook + status + auto-suppress + kart).

---

## 7. Uygulama durumu (2026-09-06, commit `20fcea5`)

### ✅ Tamamlananlar
| Madde | Commit | Not |
|---|---|---|
| F1 `textOn` DRY + WCAG düzeltme | `34d643b` | `lib/color.ts` tek kaynak; mercan üstü beyaz kontrast bug'ı düzeltildi |
| F7 `.env.example` env notları | `34d643b` | Yerel `.env.example` (gitignored) güncel |
| B1 Sentry + `lib/logger` | `34d643b` | `@sentry/nextjs` + config + instrumentation; DSN yoksa no-op |
| B2 FK index'ler | `34d643b` | migration `0046` (votes.post_id, posts.user_id/board_id, comments.user_id) |
| B4 AI fallback zinciri | `34d643b` | `chatModels()` env-tabanlı (LLM_MODEL / LLM_FALLBACK_MODEL) |
| B3 Playwright E2E smoke | `0275ab2` | `playwright.config.ts` + `e2e/smoke.spec.ts` (dışarıda çalışır) |
| F3 workspace marka aksanı | `fced119` | Layout CSS var override (WCAG text + soft/tint) |
| F4 `Select` primitive | `fced119` | `components/ui/select.tsx` + 2 ana kullanım |
| B6 post-search fold tek kaynak | `fced119` | `TR_FOLD_MAP`'ten SQL source/target türetilir + invariant test |
| B8 `getWorkspaceId` request cache | `20fcea5` | `React.cache()` (global sızma bug'ı düzeltildi) |
| B10 changelog email korrelasyonu | `eba34ed` | `email_deliveries` userId nullable + email; notify-changelog kayıt; deliverability kartı changelog'u sayar |

### ⏸️ Ertelenenler (onay / özel doğrulama gerektirir)
| Madde | Neden ertelendi |
|---|---|
| F2 canonical server-side | Client `<link rel=canonical>` yeterli; `generateMetadata`'de path alınamaz (App Router) — middleware+header çözümü büyük |
| B9 Dependabot kalıcı | Vuln'lar non-runtime (web bundle'ında yok); `@clerk/ui` kaldırma görsel doğrulama ister → GitHub Security UI'da "not exploitable" dismiss önerilir |
| B5 embedding HNSW | 2048-dim > HNSW 2000 cap; halfvec/type değişikliği + re-index — yüksek risk |
| B7 schema.ts bölme | 1106 satır tek dosya; mekanik ama breaking riski — ayrı refactor |
| F5 component yakınlaştırma | Görsel doğrulama gerektirir; kör birleştirme riskli |
| F6 erişilebilirlik audit | Kapsamlı manuel/axe denetimi — batch olarak |


---

## 8. Kaynak dosyalar (incelenen)

- Frontend: `app/globals.css`, `app/(main)/**`, `components/custom/**` (70),
  `components/ui/**` (11), `site-header.tsx`, `site-footer.tsx`, `canonical-link.tsx`.
- Backend: `app/api/**` (63 route), `lib/**` (~7k satır), `inngest/functions.ts`
  (7 fonksiyon), `migrations/**`, `tests/lib/**` (15 dosya, 64 test).
- Doküman: `DESIGN.md`, `docs/standarts.md`, `docs/plan.md`.
