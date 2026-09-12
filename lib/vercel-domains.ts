import "server-only";

import { resolveCname } from "node:dns/promises";

import { CUSTOM_DOMAIN_CNAME_TARGET } from "@/lib/dns-records";

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

// Doğrulama akışının trafik yarısı: Vercel'e bağla (yapılandırılmışsa),
// CNAME'i ve Vercel doğrulamasını oku, tek bir özet döndür.
export async function ensureDomainTraffic(domain: string): Promise<DomainTrafficResult> {
  const managed = isVercelDomainsConfigured();
  let attached = false;
  let attachDetail = "";

  if (managed) {
    const attach = await attachDomainToProject(domain);
    attached = attach.ok;
    attachDetail = attach.detail;
  }

  const cnameOk = await cnamePointsToVercel(domain);
  const vercelState = managed
    ? await readProjectDomain(domain)
    : { known: false, verified: false, detail: "" };

  if (!managed) {
    return {
      ok: cnameOk,
      attached: false,
      managed: false,
      detail: cnameOk
        ? "DNS bize bakıyor. (Otomatik bağlama yapılandırılmamış — domain projeye elle eklenmeli.)"
        : `DNS henüz bize bakmıyor. ${CUSTOM_DOMAIN_CNAME_TARGET} hedefine CNAME ekle (yayılım birkaç dakika sürer).`,
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
  if (!cnameOk) {
    return {
      ok: false,
      attached: true,
      managed: true,
      detail: `Domain projeye bağlı ama DNS henüz bize bakmıyor. ${CUSTOM_DOMAIN_CNAME_TARGET} hedefine CNAME ekle (yayılım birkaç dakika sürer).`,
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
