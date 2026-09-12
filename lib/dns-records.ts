// 2026-09-12 — custom domain TRAFİK kaydının paylaşılan sabiti.
//
// Neden ayrı dosya: bu değeri hem sunucu (doğrulama/talimat üretimi) hem de
// arayüz (kullanıcıya "şu CNAME'i ekle" metni) kullanır. `lib/custom-domain.ts`
// ve `lib/vercel-domains.ts` `server-only` taşıdığı için client bileşenden
// import EDİLEMEZLER; paylaşılan sabit bu yüzden burada durur.

/** Vercel'in müşteriye gösterilecek standart CNAME hedefi. */
export const CUSTOM_DOMAIN_CNAME_TARGET = "cname.vercel-dns.com";
