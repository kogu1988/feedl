import "server-only";

import { randomBytes } from "node:crypto";

// 2026-09-12 kod incelemesi — custom domain sahiplik doğrulaması.
//
// Önceki durum: `workspaces.customDomain` herhangi bir workspace owner'ı
// tarafından serbestçe yazılabiliyordu (biçim doğrulaması bile yoktu) ve
// `resolveWorkspaceByHost` bu alanı subdomain→slug'dan ÖNCE eşliyordu. Bir
// tenant `feedback.acme.com`'u kendi custom domain'i olarak yazıp, acme sonradan
// DNS'ini feedl'e çevirdiğinde gelen trafik o tenant'ın workspace'i olarak
// servis edilirdi (hostname squatting → marka/veri sızıntısı).
//
// Bu modül doğrulamanın TEK kaynağıdır: biçim kontrolü, rezerve host kontrolü,
// TXT kaydı adı/değeri ve doğrulama token'ı. Host çözümlemesi yalnız
// `custom_domain_verified_at` dolu olan domain'leri dikkate alır.

// feedl'in kendi host'ları custom domain olarak KULLANILAMAZ: bunlar zaten
// slug tabanlı subdomain çözümlemesine ait ve TXT kaydı eklenemez (DNS bizim).
// Net hata vermek, kullanıcıyı "DNS bulunamadı" ile uğraştırmaktan iyidir.
export const RESERVED_HOST = "feedl.app";

export function isReservedHost(host: string): boolean {
  return host === RESERVED_HOST || host.endsWith(`.${RESERVED_HOST}`);
}

// RFC 1123 host adı: en az iki etiket, her etiket 1-63 karakter, alfanumerik +
// tire (baş/son tire olamaz), toplam ≤253. IP adresleri kabul edilmez.
const HOSTNAME_RE =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Bir host custom domain olarak kabul edilebilir mi? (biçim + rezerve host + IP)
export function isValidCustomDomain(host: string): boolean {
  if (!HOSTNAME_RE.test(host)) return false;
  // Sayısal son etiket = IP adresi (örn. 1.2.3.4). Host bazlı yönlendirmede
  // anlamsız ve TXT doğrulaması da yapılamaz → kabul etme.
  const labels = host.split(".");
  if (/^\d+$/.test(labels[labels.length - 1])) return false;
  return !isReservedHost(host);
}

// Kullanıcı girdisini kanonik hale getirir: protokol/path/port atılır, küçük
// harfe çevrilir, tire sonu kırpılır, baştaki `www.` düşürülür.
// `www` düşürmek teklik indeksini de anlamlı kılar: `www.x.com` ile `x.com`
// aynı satır olur; çözümleyici zaten iki yazımı da eşliyor.
export function normalizeCustomDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "") // protokol
    .replace(/[/?#].*$/, "") // path/query/fragment
    .replace(/:\d+$/, "") // port
    .replace(/\.$/, "") // kök noktası
    .replace(/^www\./, "");
}

// Doğrulama token'ı (32 hex karakter).
export function generateDomainVerificationToken(): string {
  return randomBytes(16).toString("hex");
}

// TXT kaydı: `_feedl.<domain>` → `feedl-verify=<token>`.
export function domainVerificationRecordName(domain: string): string {
  return `_feedl.${domain}`;
}

export function domainVerificationRecordValue(token: string): string {
  return `feedl-verify=${token}`;
}
