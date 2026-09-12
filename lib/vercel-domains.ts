import "server-only";

import { resolve4, resolveCname } from "node:dns/promises";

import {
  CUSTOM_DOMAIN_APEX_IPV4,
  CUSTOM_DOMAIN_CNAME_TARGET,
  isApexDomain,
} from "@/lib/dns-records";

// 2026-09-12 (kullanıcı sorusu: "bu aslında bizim sorunumuz mu?") — EVET, bu
// sorunun TRAFİK yarısı bizim tarafımızda yapılır:
//
// Müşteri yalnız kendi DNS sağlayıcısını yönetir (bizden aldığı kayıtları girer).
// Ama Vercel, PROJEYE EKLENMEMİŞ bir host'a gelen isteği servis etmez
// ("domain not configured"). Yani `feedback.acme.com` DNS'i bize baksa bile,
// domaini Vercel projesine bizim eklememiz gerekir. Bu yüzden:
//   1) sahiplik  → TXT kaydı (müşteri ekler, biz doğrularız) — VARDI
//   2) trafik    → CNAME kaydı (müşteri ekler) + domainin projeye eklenmesi
//                  (BİZ yaparız, Vercel API ile) — BU MODÜL
//
// Yapılandırma yoksa (VERCEL_API_TOKEN / VERCEL_PROJECT_ID tanımlı değilse)
// özellik SESSİZCE bozulmaz: `isVercelDomainsConfigured()` false döner,
// arayüz kayıtları gösterip "otomatik bağlama yapılandırılmamış" der ve
// domaini elle eklemek gerekir.

const API = "https://api.vercel.com";

/** Vercel'in müşteriye gösterilecek standart CNAME hedefi (paylaşılan sabit). */
export { CUSTOM_DOMAIN_CNAME_TARGET };

// Vercel'in apex için kullandığı BİLİNEN A kaydı IP'leri. Eşleştirmede
// kullanılır (Vercel eski/yeni IP'lerden birini önerebilir); arayüzde
// gösterilen hedef her zaman Vercel'in `recommendedIPv4` yanıtıdır.
const VERCEL_APEX_IPV4_KNOWN = ["76.76.21.21", "76.76.21.61", "76.76.21.98"];

// Apex'te CNAME yasak olduğu için A kaydı gerekir; subdomain'de CNAME. Hangi
// kaydın istendiği alan adından türetilir ve arayüzde gösterilir.
export interface DomainDnsRecommendation {
  apex: boolean;
  /** Subdomain için CNAME hedefi (apex'te null). */
  cname: string | null;
  /** Apex için A kaydı hedef(ler)i. */
  ipv4: string[];
  /** Vercel yanıtı alınabildi mi (false → yedek sabitler kullanıldı). */
  fromVercel: boolean;
}

export function isVercelDomainsConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export interface DomainTrafficResult {
  /** Trafik hazır mı (CNAME doğru + Vercel tarafında verified). */
  ok: boolean;
  /** İnsan için kısa durum/detay (arayüzde gösterilir). */
  detail: string;
  /** Vercel tarafında domain projeye bağlı mı. */
  attached: boolean;
  /** Otomatik bağlama yapılandırılmış mı (token var mı). */
  managed: boolean;
}

async function vercelFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const token = process.env.VERCEL_API_TOKEN;
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      json: { error: err instanceof Error ? err.message : "network" },
    };
  }
}

function errorMessage(json: unknown): string {
  const error = (json as { error?: { message?: string } } | null)?.error;
  return error?.message ?? "Vercel API isteği başarısız.";
}

// Domaini projeye ekler (idempotent: zaten ekliyse 409 → başarı sayılır).
export async function attachDomainToProject(
  domain: string,
): Promise<{ ok: boolean; detail: string }> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) return { ok: false, detail: "VERCEL_PROJECT_ID tanımlı değil." };

  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (res.ok) return { ok: true, detail: "Domain projeye eklendi." };
  // 409 domain_already_exists → amaç zaten bu; başarı say.
  if (res.status === 409) return { ok: true, detail: "Domain zaten projeye bağlı." };
  return { ok: false, detail: errorMessage(res.json) };
}

export async function detachDomainFromProject(domain: string): Promise<void> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) return;
  await vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, {
    method: "DELETE",
  });
}

// Vercel'in domaini doğrulayıp doğrulamadığını okur.
async function readProjectDomain(
  domain: string,
): Promise<{ known: boolean; verified: boolean; detail: string }> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) return { known: false, verified: false, detail: "" };
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${domain}`);
  if (!res.ok) {
    return { known: false, verified: false, detail: errorMessage(res.json) };
  }
  const json = res.json as { verified?: boolean; verification?: unknown[] } | null;
  return {
    known: true,
    verified: Boolean(json?.verified),
    detail: "",
  };
}

// CNAME hedefi Vercel'in DNS ailesine mi ait?
// Vercel proje başına özel hedef verebilir (`abc.vercel-dns-017.com`), bu
// yüzden sabit dizeye eşitlik aranmaz. SONDA çapa (`$`) kritiktir: aksi halde
// `vercel-dns.com.saldirgan.net` gibi bir hedef "Vercel'e bakıyor" sayılırdı.
export function isVercelDnsTarget(target: string): boolean {
  return /(^|\.)vercel-dns(-\d+)?\.com$/i.test(target.trim());
}

/** A kaydı hedefi bilinen bir Vercel IP'si mi? (saf; test edilebilir) */
export function isVercelApexIp(address: string): boolean {
  return VERCEL_APEX_IPV4_KNOWN.includes(address.trim());
}

// Müşteriye hangi DNS kaydının gerektiğini söyler. Kesin kaynak Vercel'in
// `/v6/domains/{domain}/config` yanıtıdır (proje başına özel hedef verebilir);
// token yoksa veya yanıt alınamazsa apex/subdomain ayrımından türeyen yedek
// sabitler döner. Bu fonksiyon ARAYÜZ metnini beslediği için asla fırlatmaz.
export async function getDomainDnsRecommendation(
  domain: string,
): Promise<DomainDnsRecommendation> {
  const apex = isApexDomain(domain);
  const fallback: DomainDnsRecommendation = apex
    ? { apex, cname: null, ipv4: [CUSTOM_DOMAIN_APEX_IPV4], fromVercel: false }
    : {
        apex,
        cname: CUSTOM_DOMAIN_CNAME_TARGET,
        ipv4: [],
        fromVercel: false,
      };

  if (!process.env.VERCEL_API_TOKEN) return fallback;
  const res = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config`,
  );
  if (!res.ok) return fallback;

  const json = res.json as {
    recommendedCNAME?: { value?: string }[];
    recommendedIPv4?: { value?: string[] }[];
  } | null;
  const cname = json?.recommendedCNAME?.[0]?.value?.trim() || null;
  const ipv4 = json?.recommendedIPv4?.[0]?.value?.filter(Boolean) ?? [];
  if (!cname && ipv4.length === 0) return fallback;

  return {
    apex,
    // Apex'te CNAME gösterilmez (Vercel yine de öneri döndürebilir).
    cname: apex ? null : cname ?? fallback.cname,
    ipv4: apex ? (ipv4.length > 0 ? ipv4 : fallback.ipv4) : [],
    fromVercel: true,
  };
}

// CNAME gerçekten bize (Vercel'e) bakıyor mu?
// Kesin hüküm Vercel'in kendi `verified` alanıdır; bu kontrol hızlı ön elemedir.
export async function cnamePointsToVercel(domain: string): Promise<boolean> {
  try {
    const targets = await resolveCname(domain);
    return targets.some((target) => isVercelDnsTarget(target));
  } catch {
    return false;
  }
}

// DNS trafiği bize bakıyor mu? Subdomain'de CNAME, APEX'te A kaydı beklenir
// (apex'te CNAME standart olarak yasak). Apex desteği 2026-09-12'de eklendi;
// öncesinde yalnız CNAME kontrol edildiği için apex domain'lerde trafik
// durumu ASLA "hazır" görünmezdi.
export async function dnsPointsToVercel(
  domain: string,
  recommendation?: DomainDnsRecommendation,
): Promise<boolean> {
  const rec = recommendation ?? (await getDomainDnsRecommendation(domain));

  try {
    const targets = await resolveCname(domain);
    if (targets.some((target) => isVercelDnsTarget(target))) return true;
  } catch {
    /* CNAME yok (apex) ya da çözümlenemedi → A kaydını dene */
  }

  if (!rec.apex) return false;

  // Apex: A kaydı Vercel'in bilinen IP'lerinden birine bakmalı. Vercel'in
  // önerisi (varsa) önceliklidir; yine de bilinen IP'ler kabul edilir.
  const expected = new Set([...rec.ipv4, ...VERCEL_APEX_IPV4_KNOWN]);
  try {
    const addresses = await resolve4(domain);
    return addresses.some((address) => expected.has(address));
  } catch {
    return false;
  }
}

// Doğrulama akışının trafik yarısı: Vercel'e bağla (yapılandırılmışsa),
// CNAME'i ve Vercel doğrulamasını oku, tek bir özet döndür.
export async function ensureDomainTraffic(domain: string): Promise<DomainTrafficResult> {
  const managed = isVercelDomainsConfigured();
  let attached = false;
  let attachDetail = "";

  // Hangi kaydın gerektiği (A vs CNAME) + gösterilecek hedef.
  const recommendation = await getDomainDnsRecommendation(domain);
  const expectedRecord = recommendation.apex
    ? `A kaydı (ad: @) → ${recommendation.ipv4[0] ?? CUSTOM_DOMAIN_APEX_IPV4}`
    : `CNAME → ${recommendation.cname ?? CUSTOM_DOMAIN_CNAME_TARGET}`;

  if (managed) {
    const attach = await attachDomainToProject(domain);
    attached = attach.ok;
    attachDetail = attach.detail;
  }

  const dnsOk = await dnsPointsToVercel(domain, recommendation);
  const vercelState = managed
    ? await readProjectDomain(domain)
    : { known: false, verified: false, detail: "" };

  if (!managed) {
    return {
      ok: dnsOk,
      attached: false,
      managed: false,
      detail: dnsOk
        ? "DNS bize bakıyor. (Otomatik bağlama yapılandırılmamış — domain projeye elle eklenmeli.)"
        : `DNS henüz bize bakmıyor. ${expectedRecord} ekle (yayılım birkaç dakika sürer).`,
    };
  }

  if (!attached) {
    return {
      ok: false,
      attached: false,
      managed: true,
      detail: `Domain projeye eklenemedi: ${attachDetail}`,
    };
  }
  if (!dnsOk) {
    return {
      ok: false,
      attached: true,
      managed: true,
      detail: `Domain projeye bağlı ama DNS henüz bize bakmıyor. ${expectedRecord} ekle (yayılım birkaç dakika sürer).`,
    };
  }
  if (!vercelState.verified) {
    return {
      ok: false,
      attached: true,
      managed: true,
      detail: "DNS bize bakıyor; Vercel sertifika/doğrulamayı tamamlıyor (genelde 1-2 dakika).",
    };
  }
  return {
    ok: true,
    attached: true,
    managed: true,
    detail: "Trafik hazır — alan adı bu workspace'e düşüyor.",
  };
}
