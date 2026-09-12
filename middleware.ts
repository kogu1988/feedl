import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isPublicPath } from "@/lib/auth/public-paths";

// Public route'ların TEK kaynağı artık `lib/auth/public-paths.ts`'tir (açık
// allowlist + birim testleri). 2026-09-12 (teknik borç #21): Clerk'in deprecated
// `createRouteMatcher`'ı kaldırıldı — gerekçesi tam da bu repoda 3 kez bug
// üreten sınıftı ("path matching … leave protected resources reachable").
//
// Korunan yüzeyler (özette): `/dashboard(.*)`, `/onboarding` (kendi guard'ı da
// var) ve allowlist'te OLMAYAN her şey — kural fail-closed.
//
// İstisnalar ve nedenleri:
// - `/` + `/portal` + `/roadmap` + `/changelog` herkese açık (public read).
// - `GET /api/posts` public; POST handler içinde auth zorunlu.
// - `/api/webhooks/*` imza doğrulamasıyla public.
// - `/api/inngest` Inngest Cloud/Dev Server çağırır (production'da signing key
//   doğrulaması `serve()` içinde).
// - `/widget` + `/api/widget/*` widget SDK'sıdır: iframe Clerk oturumu taşımaz,
//   kimlik feedl'in kendi widget çerezinden (lib/widget/jwt) handler'da çözülür.

// Sprint 55 (Platformlaşma #3) — board temiz URL: `/portal/:slug` (uuid
// değil, ayrılmış static değil) → `/portal?board=:slug` REWRITE edilir.
// Böylece URL `/portal/feature-requests` olarak KALIR (redirect değil),
// post detayı ([id] / uuid) ve statik sayfalar (changelog, oyladiklarim)
// korunur. Eski [id] sayfasındaki slug→?board redirect'i yedeğe düşer.
const RESERVED_PORTAL_SEGMENTS = new Set(["changelog", "oyladiklarim"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}$/;

function portalBoardRewrite(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const match = /^\/portal\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const slug = match[1];
  // UUID → post detay ([id]); statik segmentler → değişmez.
  if (UUID_RE.test(slug) || RESERVED_PORTAL_SEGMENTS.has(slug)) return null;
  if (!BOARD_SLUG_RE.test(slug)) return null;
  const url = req.nextUrl.clone();
  url.pathname = "/portal";
  url.search = `?board=${encodeURIComponent(slug)}`;
  return NextResponse.rewrite(url);
}

// Middleware SADECE giriş kontrolü + board temiz URL rewrite'i yapar. Admin
// yetkisi tek kaynak olarak Neon users.role alanından sayfa/API içinde kontrol
// edilir (plan.md Sprint 1).
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const rewrite = portalBoardRewrite(req);
  if (rewrite) return rewrite;
  if (!isPublicPath(req.nextUrl.pathname)) {
    await auth.protect();
  }

  // F2 (Sprint 63y): server-side canonical için tam path'i `generateMetadata`'e
  // taşır (App Router'da full path metadata'ya gelmez; header ile geçirilir).
  const headers = new Headers(req.headers);
  headers.set("x-feedl-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
