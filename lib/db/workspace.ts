import { and, eq, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { cache } from "react";

import { getDb } from "./index";
import { workspaces } from "./schema";
import { getWidgetSession } from "../widget/jwt";
import { cookies } from "next/headers";

// Sprint 63 (onboarding): kullanıcının aktif workspace slug'ı çerezde tutulur
// (feedl_active_ws). Self-serve onboarding sonrası kullanıcı kendi oluşturduğu
// workspace'e "girer". SADECE bu çerez varsa host yerine o slug tercih edilir.
//
// GÜVENLİK MODELİ (Sprint 63 rev.): bu çerez bir YETKİ BARIYERİ DEĞİL, yalnızca
// hangi workspace bağlamında çalışılacağını seçen bir ROUTING İPUCU'DUR.
// İstemci onu istediği slug'a değiştirebilir; ancak:
//  - Admin/dashboard erişimi getAdminUserId → getWorkspaceRole ile PER-WORKSPACE
//    doğrulanır — çerez başka bir workspace'i işaret etse de kullanıcının o
//    workspace'te owner/admin/üye olması gerekir, aksi halde rol null → erişim yok.
//  - Portal yazma (post/vote/comment) yalnızca public board'lara açıktır; private
//    board'lar portal üzerinden zaten reddedilir (app/api/posts/route.ts).
// Yani çerez doğrudan başka bir kiracının admin verisine erişim sağlamaz;
// güvenlik sınırı = rol kontrolü + board visibility kontrolü.
const ACTIVE_WS_COOKIE = "feedl_active_ws";

// Sprint 48e (madde 8): subdomain routing — getWorkspaceId artık isteğin
// host'u bazında workspace çözer. `acme.feedl.app` → workspaces.slug='acme';
// `feedl.app` (kök) ve `www.feedl.app` → varsayılan 'feedl'. Bilinmeyen
// subdomain varsayılana düşer (tek workspace döneminde geriye dönük uyumlu).
// next/headers yalnızca server context'te çalışır; middleware (edge) DB'ye
// erişmediği için burada çözüm yapılmaz — middleware auth/yönlendirme yapar.
import { headers } from "next/headers";

// Bilinmeyen host'ların düştüğü varsayılan workspace. SİLİNEMEZ: host → workspace
// çözümlemesi (`resolveWorkspaceByHost`) bu satır yoksa hata verir, yani
// varsayılan workspace'i silmek feedl.app'in kendisini 500'e düşürür. Silme
// API'si bu slug'ı reddeder (bkz. app/api/admin/workspace/route.ts DELETE).
export const DEFAULT_WORKSPACE_SLUG = "feedl";
const workspaceIdSchema = z.uuid();

// `feedl.app` kök/alt alan adları ve NEXT_PUBLIC_APP_URL — bunların dışında
// kalan subdomain'ler workspace slug'ı olarak değerlendirilir.
// (Sprint 63i: test için export edildi — host→workspace izolasyonu.)
export function isFeedlRootHost(host: string): boolean {
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? "")
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .toLowerCase();
  // Gelen host PORT içerebilir (localhost:3000) — host karşılaştırması porta
  // duyarsız olmalı. 2026-09-12: bu eksik olduğu için NEXT_PUBLIC_APP_URL
  // `http://localhost:3000` iken bile root host tanınmıyordu; `/` landing
  // yerine /portal'a yönleniyordu ve landing e2e'de hiç test EDİLEMİYORDU.
  // Üretimde host'larda port yok → davranış değişmez.
  const bare = host.trim().toLowerCase().replace(/:\d+$/, "");
  return (
    bare === "feedl.app" ||
    bare === "www.feedl.app" ||
    (appHost ? bare === appHost : false)
  );
}

// Host'tan workspace slug'ı çöz. Feedl kök hostlar → 'feedl'; değilse
// host'un ilk parçası (subdomain). (Sprint 63i: test için export edildi.)
export function slugFromHost(host: string): string {
  return subdomainSlugFromHost(host) ?? DEFAULT_WORKSPACE_SLUG;
}

// feedl subdomain'inden slug çıkar; host feedl.app ailesine ait DEĞİLSE null.
// (2026-09-12 fail-closed karar) `slugFromHost`'tan farkı: bilinmeyen/bizim
// olmayan host'ta varsayılanı DÖNDÜRMEZ. Aksi halde `feedback.acme.com` gibi
// doğrulanmamış bir host "feedl" slug'ına sorgu atıp varsayılan workspace'i
// servis ederdi (custom domain yolu tutmazsa ortaya çıkan sızıntı).
export function subdomainSlugFromHost(host: string): string | null {
  if (isFeedlRootHost(host)) {
    return DEFAULT_WORKSPACE_SLUG;
  }
  const normalized = normalizeDomainForMatch(host);
  const parts = normalized.split(".");
  if (parts.length >= 3 && normalized.endsWith(".feedl.app")) {
    return parts[0];
  }
  return null;
}

// Varsayılan workspace'e DÜŞMESİ GÜVENLİ olan host'lar (2026-09-12 karar,
// fail-closed):
//  - feedl kök host'ları (feedl.app / www.feedl.app / NEXT_PUBLIC_APP_URL)
//  - kendi Vercel preview deploy'larımız (`*.vercel.app`) — bunlar bizim
//    projemizin dağıtımlarıdır, üçüncü bir taraf bu host'u bize yönlendiremez.
//  - loopback (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`) — yerel geliştirme.
//    Gerekli: `.env.local`'da `NEXT_PUBLIC_APP_URL=https://feedl.app` iken
//    `http://localhost:3000` kök host SAYILMAZ; bu kural olmadan yerelde her
//    sayfa 404 olurdu (e2e a11y testleri tam olarak bunu yakaladı). Loopback
//    hiçbir zaman herkese açık bir hostname değildir, bu yüzden güvenli.
// Bu listenin DIŞINDAKİ bir host'ta workspace çözülemezse artık varsayılana
// düşülmez; sayfa katmanı 404 verir. Sebep: wildcard DNS'te her hostname'e 200
// dönmek (a) sınırsız duplicate-content, (b) markayı rastgele hostname'lere
// ödünç verme, (c) yanlış yazılmış adresi "çalışıyor" gibi gösterme.
export function isDefaultFallbackHost(host: string): boolean {
  if (isFeedlRootHost(host)) return true;
  const bare = normalizeDomainForMatch(host);
  if (bare === "vercel.app" || bare.endsWith(".vercel.app")) return true;
  return (
    bare === "localhost" ||
    bare === "127.0.0.1" ||
    bare === "[::1]" ||
    bare === "::1" ||
    bare === "0.0.0.0"
  );
}

// İsteğin host'unu çöz (middleware'de değil, server context'te).
async function getRequestHost(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-host") ??
      h.get("host") ??
      (process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app")
    );
  } catch {
    // headers() yalnızca server context'te; dışarıda (test/CLI) fallback.
    return (process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app");
  }
}

// Sprint 63q (custom domain) — host'u custom-domain eşleştirmesi için
// normalleştirir: küçük harf, `:port` ve sonda nokta atılır. `www.` prefix'i
// KOŞULLU olarak ayrıca ele alınır (aşağıda `resolveWorkspaceByHost`'ta hem
// bare hem www eşleşmesi denenir), bu yüzden fonksiyon www'yi KIRPMEZ —
// yalnız port/sonda nokta/normalizasyon yapar. (Sprint 63i: test için export.)
export function normalizeDomainForMatch(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export type ResolvedWorkspace = { id: string; slug: string; name: string };

// Host'tan workspace ARA (varsayılana düşmeden): doğrulanmış custom domain →
// feedl subdomain slug. Bulunamazsa null.
async function lookupWorkspaceByHost(
  host: string,
): Promise<ResolvedWorkspace | null> {
  // 1) Custom domain eşleşmesi (www'li/www'suz yazımlar). Yalnız TXT kaydıyla
  // DOĞRULANMIŞ domain'ler dikkate alınır (2026-09-12): aksi halde bir tenant
  // başkasının hostname'ini yazıp, kurban DNS'ini feedl'e çevirdiğinde onun
  // trafiğini kendi workspace'i olarak servis edebilirdi (hostname squatting).
  const hostNorm = normalizeDomainForMatch(host);
  const bareHost = hostNorm.startsWith("www.") ? hostNorm.slice(4) : hostNorm;
  const [byCustom] = await getDb()
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
    .from(workspaces)
    .where(
      and(
        isNotNull(workspaces.customDomainVerifiedAt),
        or(
          eq(workspaces.customDomain, hostNorm),
          eq(workspaces.customDomain, bareHost),
          eq(workspaces.customDomain, `www.${bareHost}`),
        ),
      ),
    )
    .limit(1);
  if (byCustom) {
    return byCustom;
  }

  // 2) Subdomain → slug (acme.feedl.app → acme). feedl.app ailesine ait
  // olmayan host'ta slug YOKTUR (`subdomainSlugFromHost` → null) — aksi halde
  // doğrulanmamış bir custom domain varsayılan workspace'e düşerdi.
  const slug = subdomainSlugFromHost(host);
  if (slug) {
    const [row] = await getDb()
      .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);
    if (row) {
      return row;
    }
  }

  return null;
}

async function loadDefaultWorkspace(): Promise<ResolvedWorkspace> {
  const [fallback] = await getDb()
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.slug, DEFAULT_WORKSPACE_SLUG))
    .limit(1);
  if (!fallback) {
    throw new Error(
      `Workspace "${DEFAULT_WORKSPACE_SLUG}" bulunamadı. Migration'ları uygulayın.`,
    );
  }
  return fallback;
}

// Host'a göre workspace'i çöz; workspace YOKSA varsayılana düşer (geriye dönük
// sözleşme — testler ve kök-host/preview çağrıları bunu bekler). Yeni
// yüzeyler fail-closed kapıyı kullanmalıdır: `resolveWorkspaceForHostname`.
export async function resolveWorkspaceByHost(
  host: string,
): Promise<ResolvedWorkspace> {
  return (await lookupWorkspaceByHost(host)) ?? (await loadDefaultWorkspace());
}

// `resolveWorkspaceByHost`'un FAIL-CLOSED sürümü (2026-09-12 karar): yalnız
// kök host / Vercel preview için varsayılana düşer; bilinmeyen host'ta null
// döner. Çağıran (sayfa katmanı) null'da 404 verir. Sunucu tarafı kapı
// BİLEREK `getWorkspaceId` içinde DEĞİL: orada `catch {}` blokları (ör.
// changelog/page.tsx) notFound() hatasını yutar ve kırık sayfa render edilir.
export async function resolveWorkspaceForHostname(
  host: string,
): Promise<ResolvedWorkspace | null> {
  if (isDefaultFallbackHost(host)) {
    return loadDefaultWorkspace();
  }
  return lookupWorkspaceByHost(host);
}

// İsteğin host'u bilinen bir workspace'e çözülüyor mu? (app/(main)/layout.tsx
// bu kapıyı kullanır; app/not-found.tsx aynı çağrıyla "host yok" varyantını seçer.)
export async function resolveWorkspaceForCurrentHost(): Promise<ResolvedWorkspace | null> {
  return resolveWorkspaceForHostname(await getRequestHost());
}

// Sprint 63p — widget tenant-aware: `?ws=<slug>` param'sından workspace id
// çözer (yalnız widget/iframe sayfası ve widget API uçları). Slug yoksa veya
// workspace yoksa null döner — çağıran getWorkspaceId'e (host/çerez) düşer.
export async function resolveWorkspaceIdFromSlug(
  slug: string | null | undefined,
): Promise<string | null> {
  if (!slug) return null;
  const [row] = await getDb()
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  if (!row) return null;
  try {
    return workspaceIdSchema.parse(row.id);
  } catch {
    return null;
  }
}

// Showcase (vitrin) modu: feedl kök host'undaki (feedl.app / www /
// NEXT_PUBLIC_APP_URL) portal/roadmap/changelog yüzeyleri ziyaretçiye vitrin
// olarak sunulur — tanıtım amaçlı, etkileşim kapalı. Müşteri subdomain'leri
// (acme.feedl.app) gerçek portal olarak etkileşimli kalmaya devam eder.
// Sayfalar bunu oturum kontrolüyle birleştirir: üye/admin girişliyse vitrin
// değil gerçek kullanım (dogfooding) söz konusudur.
export async function isShowcaseRequest(): Promise<boolean> {
  return isFeedlRootHost(await getRequestHost());
}

// Sprint 63w (B8) — fetchWorkspaceId React.cache() ile REQUEST-SCOPED memoized.
// Eski module-level `cached` global'i sinsi bir bug içeriyordu: widget çerezi
// (workspace A) feedl.app host'unda çözülünce `cached={host:feedl.app,id:A}`
// yazılıyordu; aynı container'da sıradaki PORTAL isteği (feedl.app) host eşleşince
// YANLIŞLIKLA A'nın id'sini döndürebiliyordu. React.cache istek başına çalışır,
// state request'ler arası SIZMAZ (her istek kendi izole cache'ini alır).
const fetchWorkspaceId = cache(async (): Promise<string> => {
  const host = await getRequestHost();

  // Sprint 63p — widget tenant-aware: widget oturumu (httpOnly feedl_widget
  // çerezi) yalnız widget/iframe bağlamında vardır. Oturum, müşterinin
  // `data-feedl-workspace` slug'ını taşır; host (müşteri sitesi) yerine onu
  // tercih ederiz. Böylece acme.com widget'ı varsayılan değil, acme
  // workspace'ine düşer. Admin/portal bağlamında bu çerez yoktur → etki yok.
  const wsSession = await getWidgetSession();
  if (wsSession?.workspaceSlug) {
    const [widgetRow] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, wsSession.workspaceSlug))
      .limit(1);
    if (widgetRow) {
      return workspaceIdSchema.parse(widgetRow.id);
    }
  }

  // Aktif workspace çerezi varsa önce onu dene (onboarding sonrası).
  const activeSlug = await readActiveWorkspaceCookie();
  if (activeSlug) {
    const [row] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, activeSlug))
      .limit(1);
    if (row) {
      return workspaceIdSchema.parse(row.id);
    }
  }

  const resolved = await resolveWorkspaceByHost(host);
  return workspaceIdSchema.parse(resolved.id);
});

export const getWorkspaceId = fetchWorkspaceId;

async function readActiveWorkspaceCookie(): Promise<string | null> {
  try {
    const c = await cookies();
    return c.get(ACTIVE_WS_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// Sprint 48k: workspace marka bilgisi (portal üst barı/logo). Marka yoksa
// default feedl değerleri.
export interface WorkspaceBrand {
  name: string;
  customDomain: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}

export async function getWorkspaceBrand(): Promise<WorkspaceBrand> {
  try {
    const [row] = await getDb()
      .select({
        name: workspaces.name,
        customDomain: workspaces.customDomain,
        brandColor: workspaces.brandColor,
        logoUrl: workspaces.logoUrl,
      })
      .from(workspaces)
      .where(eq(workspaces.id, await getWorkspaceId()))
      .limit(1);
    if (row) return row;
  } catch {
    // workspace yok → default
  }
  return { name: "feedl", customDomain: null, brandColor: null, logoUrl: null };
}
