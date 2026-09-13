// 2026-09-12 (Free/Pro dil birliği) — plan konumlandırmasının ve plan
// matrisinin TEK kaynağı. Landing, /pricing ve rehberler aynı cümleleri
// kullanır; farklı yüzeylerin aynı ürün gerçekliğini farklı anlatması
// ("üç farklı ürün tanımı") önlenir.
//
// NEDEN `plan-config.ts` İÇİNDE DEĞİL: o dosya `"use client"` taşıyor. Bir
// client modülünden düz VERİ import edildiğinde server component tarafında
// değer undefined gelir (client reference proxy'si) — 2026-09-12'de bu tam
// olarak oldu: landing ve /pricing'de konumlandırma cümlesi HTML'e BOŞ
// (`<!-- -->`) düştü. `"use client"` YOKSA hem server hem client tarafta
// normal sabit olarak okunur. Fiyat/price-id gibi client gerektiren değerler
// `plan-config.ts`'te kalır.
//
// Denetlenmiş plan matrisi (2026-09-12; KOD üzerinden doğrulandı ve kullanıcı
// kararlarıyla kapılar eklendi):
//  Free → **1 workspace** · 1 board · 1 üye · 50 takipçi; fikir+oy+yorum; AI
//         etiketleme/özet/tekrar tespiti; yol haritası & changelog; toplu
//         aksiyonlar & kayıtlı görünümler; widget; "Powered by feedl" rozeti.
//         Workspace sayısı sınırı API'de (`lib/db/workspace-limits.ts`): Free
//         hesap 1 workspace, çünkü plan limitleri workspace BAŞINA ve aksi
//         halde sınırsız Free workspace açıp "Pro = sınırsız board" dolanılırdı.
//  Pro  → kodda `requirePro` ile GATE'li: **sınırsız workspace**, entegrasyonlar,
//         AI içgörüleri (korpus analizi), **gizli (private) board**
//         (`/api/admin/boards`), **gelir skoru & raporu** (`/dashboard/revenue`
//         + dashboard skor sütunu) ve **onun girdisi: şirket MRR'ı + fırsatlar**
//         (`/api/admin/companies` POST/PATCH'te mrr > 0,
//         `/api/admin/opportunities*` tamamen), **sonuç (outcome) kaydı**
//         (`/api/admin/post-outcomes` POST — yayına giren işin gerçekleşen
//         etkisi; okuma/silme serbest), API key + webhook, CSV
//         içe/dışa, marka kaldırma + özel alan adı, sınırsız board/takipçi +
//         10 üye.
//  NOT: Şirket ve ÜYE yönetimi Free KALIR — `loadCustomerCounts`
//  dashboard'daki "Müşteri" sayacını company_members üzerinden hesaplar; tüm
//  ekranı kapatmak Free'nin mevcut değerini kırpardı. Free'de MRR alanı
//  kapalıdır ve gönderilmez (mevcut değer korunur, silinmez).
//
// 2026-09-12 kapanan uyumsuzluk: private board'lar, gelir skoru ve toplu
// aksiyon/kayıtlı görünümler pazarlanıyordu ama kodda kapı yoktu. Kullanıcı
// kararı: ilk ikisi Pro (kapı eklendi), sonuncusu Free (pazarlama düzeltildi).
// Aynı turda MRR/fırsat girişi de Pro'ya alındı (gelir skorunun girdisi),
// şirket+üye yönetimi Free bırakıldı.
export const PLAN_POSITIONING = {
  free: "Free geri bildirimi toplar.",
  pro: "Pro hangi geri bildirimin gerçekten önemli olduğunu gösterir.",
} as const;

// 2026-09-13 (Sprint 69.3) — HESAP DÜZEYİ PRO açıklaması.
//
// Kural: bir hesabın SAHİP OLDUĞU workspace'lerden biri Pro ise, o kişinin
// sahip olduğu DİĞER workspace'ler de Pro sayılır (lib/paddle.ts →
// resolveAccountPlanKey). Başkasının workspace'ine `member` olarak eklenmek bu
// devralmayı VERMEZ — kararı oranın owner'ı verir.
//
// Neden yüzeylere yazılır: önceden Pro kullanıcı ikinci bir workspace açtığında
// orada Free limitleri ve "Pro" kilitleri görüyordu ("CSV İndir · Pro") ve bunun
// NEDEN böyle olduğunu anlatan hiçbir metin yoktu. Kural doğruydu ama
// görünmüyordu; tek cümle bu sürprizi kapatır.
export const ACCOUNT_PRO_NOTE =
  "Bir workspace'inde Pro varsa, sahip olduğun diğer workspace'lerde de Pro açılır.";

// 2026-09-13 (Sprint 69.4) — "14 gün" üç ayrı kavram: ücretsiz DENEME süresi,
// iade penceresi ve yasal cayma hakkı. Kullanıcıya tek bir "14 gün" gibi
// sunulmaması gerektiği için fiyat/kart metinlerinde bu ayrım açıkça yazılır.
// Sayı BİLEREK yazılmaz: `PRO_TRIAL_DAYS` client modülünde (`plan-config.ts`)
// yaşar ve buradan import edilirse sunucuda `undefined` gelir (client reference
// proxy'si) — sabiti iki yere kopyalamak yerine metni sayısız tutuyoruz.
export const TRIAL_VS_WITHDRAWAL_NOTE =
  "Ücretsiz deneme ile yasal cayma/iade hakkı ayrı şeylerdir; ayrıntı İade Politikası'nda.";

// Sprint 69.2 — TR-first: fiyat birimi notu SUNUCU tarafında da okunabilmeli.
//
// Neden burada (plan-config'te DEĞİL): `plan-config.ts` "use client" taşır;
// oradaki bir FONKSİYONU sunucu bileşeninde çağırmak client-reference proxy'sine
// takılır. Bu modül client'sız olduğu için hem sunucuda hem client'ta çalışır.
export function priceCurrencyNote(): string {
  return process.env.NEXT_PUBLIC_PRICE_CURRENCY === "TRY"
    ? "Fiyatlar TL, vergi dahildir."
    : "Fiyatlar USD, vergi dahildir.";
}
