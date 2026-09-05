import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./index";
import { workspaces } from "./schema";
import { cookies } from "next/headers";

// Sprint 63 (onboarding): kullanıcının aktif workspace slug'ı çerezde tutulur
// (feedl_active_ws). Self-serve onboarding sonrası kullanıcı kendi oluşturduğu
// workspace'e "girer". SADECE bu çerez varsa host yerine o slug tercih edilir.
const ACTIVE_WS_COOKIE = "feedl_active_ws";

// Sprint 48e (madde 8): subdomain routing — getWorkspaceId artık isteğin
// host'u bazında workspace çözer. `acme.feedl.app` → workspaces.slug='acme';
// `feedl.app` (kök) ve `www.feedl.app` → varsayılan 'feedl'. Bilinmeyen
// subdomain varsayılana düşer (tek workspace döneminde geriye dönük uyumlu).
// next/headers yalnızca server context'te çalışır; middleware (edge) DB'ye
// erişmediği için burada çözüm yapılmaz — middleware auth/yönlendirme yapar.
import { headers } from "next/headers";

const DEFAULT_WORKSPACE_SLUG = "feedl";
const workspaceIdSchema = z.uuid();

// `feedl.app` kök/alt alan adları ve NEXT_PUBLIC_APP_URL — bunların dışında
// kalan subdomain'ler workspace slug'ı olarak değerlendirilir.
function isFeedlRootHost(host: string): boolean {
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? "")
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .toLowerCase();
  return (
    host === "feedl.app" ||
    host === "www.feedl.app" ||
    (appHost ? host === appHost : false)
  );
}

// Host'tan workspace slug'ı çöz. Feedl kök hostlar → 'feedl'; değilse
// host'un ilk parçası (subdomain).
function slugFromHost(host: string): string {
  const normalized = host.replace(/[:\s]/g, "").toLowerCase();
  if (isFeedlRootHost(normalized)) {
    return DEFAULT_WORKSPACE_SLUG;
  }
  // subdomain.feedl.app → 'subdomain'
  const parts = normalized.split(".");
  if (parts.length >= 3 && normalized.endsWith("feedl.app")) {
    return parts[0];
  }
  return DEFAULT_WORKSPACE_SLUG;
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

// Host'a göre workspace'i çöz; yoksa varsayılan 'feedl'.
// Dönen: workspace id + slug + name.
export async function resolveWorkspaceByHost(
  host: string,
): Promise<{ id: string; slug: string; name: string }> {
  const slug = slugFromHost(host);
  const [row] = await getDb()
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  if (row) {
    return row;
  }
  // Bilinmeyen subdomain → varsayılan workspace.
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

// Request başına workspace id cache'i: aynı request'te birden çok çağrı
// DB'yi tekrar vurmasın. host değişimi (farklı request) farklı instance'ta
// izole olur; serverless'ta her istek yeni izlenim — kısa ömürlü cache yeterli.
let cached: { host: string; id: string } | null = null;

export async function getWorkspaceId(): Promise<string> {
  const host = await getRequestHost();
  // Aktif workspace çerezi varsa önce onu dene (onboarding sonrası).
  const activeSlug = await readActiveWorkspaceCookie();
  if (activeSlug) {
    const [row] = await getDb()
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, activeSlug))
      .limit(1);
    if (row) {
      const id = workspaceIdSchema.parse(row.id);
      cached = { host, id };
      return id;
    }
  }
  if (cached && cached.host === host) {
    return cached.id;
  }
  const resolved = await resolveWorkspaceByHost(host);
  const id = workspaceIdSchema.parse(resolved.id);
  cached = { host, id };
  return id;
}

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
