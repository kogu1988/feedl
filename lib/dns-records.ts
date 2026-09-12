// 2026-09-12 — custom domain TRAFİK kaydının paylaşılan sabitleri + apex tespiti.
//
// Neden ayrı dosya: bu değerleri hem sunucu (doğrulama/talimat üretimi) hem de
// arayüz (kullanıcıya "şu CNAME'i / şu A kaydını ekle" metni) kullanır.
// `lib/custom-domain.ts` ve `lib/vercel-domains.ts` `server-only` taşıdığı için
// client bileşenden import EDİLEMEZLER; paylaşılan sabitler bu yüzden burada.

/** Vercel'in müşteriye gösterilecek standart CNAME hedefi. */
export const CUSTOM_DOMAIN_CNAME_TARGET = "cname.vercel-dns.com";

/**
 * Apex (kök) alan adları için A kaydı hedefi — CNAME apex'te standart olarak
 * yasak olduğu için tek yol budur.
 *
 * UYARI: bu YEDEK değerdir. Gerçek hedef Vercel'in
 * `/v6/domains/{domain}/config` yanıtındaki `recommendedIPv4` alanıdır
 * (`lib/vercel-domains.ts` → `getDomainDnsRecommendation`); Vercel proje
 * başına farklı hedef verebilir.
 */
export const CUSTOM_DOMAIN_APEX_IPV4 = "76.76.21.21";

/**
 * Çok etiketli public suffix'ler. Apex tespiti için kısa bir liste tutulur:
 * `acme.com.tr` ve `acme.co.uk` apex'tir ama etiket sayısı 3'tür, naive
 * "2 etiket = apex" kuralı bunları subdomain sayardı.
 *
 * Kesin kaynak yine Vercel'in yanıtıdır; bu liste token yokken/yanıt
 * alınamadığında arayüzün doğru kaydı (A vs CNAME) göstermesi içindir.
 */
const MULTI_LABEL_SUFFIXES = [
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.tr",
  "net.tr",
  "org.tr",
  "com.br",
  "com.au",
  "co.nz",
  "co.jp",
  "co.in",
  "com.mx",
  "com.ar",
  "co.za",
  "com.sg",
  "com.hk",
];

/**
 * Alan adı apex (kök) mi? Apex'te CNAME kullanılamaz → A kaydı gerekir.
 * `acme.com` / `acme.com.tr` → true; `feedback.acme.com` → false.
 */
export function isApexDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.includes(":") || host.includes("/")) return false;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  // Apex = public suffix + 1 etiket. Suffix'in kaç etiket olduğunu bul:
  // `acme.com` (1 etiketli suffix) 2 etiketle apex'tir, `acme.com.tr`
  // (2 etiketli suffix) 3 etiketle. Naive "2 etiket = apex" kuralı ikincisini
  // kaçırırdı; naive "suffix listede varsa apex" kuralı ise
  // `feedback.acme.com.tr`yi yanlışlıkla apex sayardı.
  const suffixLabels = MULTI_LABEL_SUFFIXES.includes(labels.slice(-2).join("."))
    ? 2
    : 1;
  return labels.length === suffixLabels + 1;
}
