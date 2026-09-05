# feedl — Ürün Dokümanı

> Tek kaynak: `product.md` + `positioning.md`. Amaç: feedl'i SaaS olarak
> konumlandırmak, kimin için olduğunu netleştirmek, satış yüzeylerinin
> (landing, pricing, demo) sözünü tek kaynağa bağlamak.

## 1. Ne → Niçin

feedl, **müşteri geri bildirimini ürün kararına dönüştüren** bir platformdur.
Bir yazılım şirketinin müşterileri "şu özelliği istiyorum" der; ekip bu
istekleri toplar, sıralar, geliştirir ve yayınlandığında duyurur. feedl bu
döngüyü tek bir herkese açık topluluk portalında otomatikleştirir.

**Sorun (rakip Canny'nin çözmediği yan):** Canny yüksek fiyatlı ($79/ay) ve
esas olarak oy toplamaya; feedl ise **AI analiz + gelir/önceliklendirme** ile
farklılaşır — "en çok oy alan" yerine "en çok **getiri** getiren" özelliğin
öne çıkması.

## 2. Kimin için (Persona)

- **Hedef müşteri:** KOBİ / erken aşama SaaS ürün sahibi (tek ürün, küçük ekip).
- **Yarı-yarına:** ~2–20 kişilik ürün+destek ekibi; geri bildirim dağınık
  (e-posta, destek, Slack, roadmap) birikiyor.
- **Kullanıcı:** Client'ın (platformu kullanan şirketin) **müşterileri** —
  public portalda oy veren son kullanıcılar.

## 3. Değer önerisi

> **"Müşteri isteklerini tahminle değil, veriyle önceliklendir."** — Feedl,
> geri bildirimi otomatik sınıflandırır, duygu analizi yapar, kopyaları
> yakalar, gelir bağlamını (müşteri + fırsat değeri) birleştirip hangi
> özelliğin önce geliştirileceğini gösterir; yayınlanınca herkese otomatik
> duyurur.

## 4. Temel özellikler

1. **Autopilot (AI):** Her fikir otomatik özet + etiket + benzer eşleştirme +
   duygu analizi. Korpus seviyesi içgörüler (temalar, riskler, hızlı kazanımlar).
2. **Oylama & Yol Haritası:** Şeffaf durumlar; sürükle-bırak kanban; herkese
   açık yol haritası.
3. **Değişiklik Günlüğü:** Draft → yayın akışı; herkese açık güncelleme sayfası.
4. **Gelir Skoru:** Oy + müşteri sayısı + fırsat değeri (MRR) → revenue-weighted
   prioritization.
5. **Ekip & Roller:** Owner / admin / contributor / member — kısmi dashboard
   erişimi, iç notlar (private).
6. **Entegrasyonlar:** Slack, Zendesk, Intercom, Linear, Jira, Webhook'lar,
   Public API (`/api/v1`) + müşteri sitesine gömülen widget.
7. **Multi-tenant:** Her workspace kendi subdomain'i (`acme.feedl.app`), kendi
   markası (logo/renk/domain), kendi board'ları.
8. **Public API + Webhook:** HMAC-SHA256 imzalı olaylar, anahtar erişimi.

## 5. Fiyatlandırma (bakınız `pricing/page.tsx` ve `plan-config.ts`)

- **Free:** 1 board · 1 üye · 50 takipçi · "Powered by feedl" rozeti.
- **Pro:** Sınırsız board · 10 üye · özel domain · marka kaldırma. Aylık/yıllık
  (yıllıkta aylık indirimli). (Paddle sandbox; canlı geçiş yakında.)
- Model: Canny benzeri **kullanıcı başına değil, ekip/board başına** sabit ücret
  + workspace kaynak limitleri.

## 6. Farklılaşma (neden feedl?)

| | Canny ($79/ay Pro) | FeedLog (self-host) | **feedl** |
|---|---|---|---|
| Hosted + hızlı kurulum | ✅ | ❌ (self-host) | ✅ |
| AI analiz (etiket/özet/duygu) | ✅ | ⚠️ | ✅ |
| Gelir/opportunity skoru | ✅ | ❌ | ✅ |
| Public API + Webhook | ✅ | ⚠️ | ✅ |
| Fiyat | pahalı | ücretsiz+operasyon | **uygun, hosted** |

**Konum:** "Canny'nin AI + gelir zekası, self-host derdi olmadan, uygun fiyata."

## 7. Kapsam dışı (şimdilik)

- Enterprise SSO/audit — tek admin, Clerk standart auth.
- Kurulumu takip eden tam otomatik self-host edition.
- Platform-marketplace entegrasyonları (teknik connector'lar dışında).
