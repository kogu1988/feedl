import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Public route'lar (standarts.md §1.1):
// - "/" ve "/portal" sayfa görünümü herkese açık (public read)
// - GET /api/posts public; POST handler içinde auth zorunlu tutulur
// - /api/webhooks/* imza doğrulamasıyla public
// - /api/inngest Inngest Cloud/Dev Server tarafından çağrılır (production'da

//   signing key doğrulaması serve() içinde yapılır)

// - /widget sayfası + /api/widget/* widget SDK'sıdır (plan.md Sprint 32):
//   iframe içinde Clerk oturumu taşınmaz; kimlik feedl'in kendi widget
//   çerezinden (lib/widget/jwt) handler içinde çözülür
// Fikir gönderme, oy verme ve admin işlemleri korumalıdır.

const isPublicRoute = createRouteMatcher([

  "/",

  "/sign-in(.*)",

  "/sign-up(.*)",

  "/portal(.*)",

  "/roadmap(.*)",

  // Changelog 2026-09-05'te /portal altından üst seviyeye taşındı —
  // herkese açık kalır (anonim ziyaretçi abone olabilir).
  "/changelog(.*)",

  "/invites(.*)",

  // Sprint 49: public fiyatlandırma sayfası (Paddle checkout sandbox/live,
  // Clerk oturumu gerekmez).
  "/pricing",

  // Sprint 50: public demo/ürün turu sayfası (satış landing'inin "Canlı
  // Demo" butonu buraya gider; Clerk oturumu gerekmez).
  "/demo",

  // Sprint 50: yasal/şirket sayfaları (footer) — public, Clerk gerekmez.
  "/privacy",
  "/terms",
  "/contact",

  "/widget",
  "/api/posts(.*)",

  // Public API (Sprint 34): kimlik Bearer API key ile handler içinde
  // doğrulanır (lib/api-keys.ts), Clerk oturumu gerekmez
  "/api/v1(.*)",

  "/api/widget(.*)",
  "/api/webhooks(.*)",

  // Sprint 48o: Slack/Zendesk/Intercom entegrasyon webhook'ları — Slack
  // kendi imzasıyla çağırır (lib/slack), Clerk oturumu gerekmez.
  "/api/integrations(.*)",

  "/api/inngest(.*)",

  // Sprint 40: changelog e-posta aboneliği — anonim ziyaretçiler de
  // abone olabilir; e-posta formatı handler içinde doğrulanır
  "/api/changelog(.*)",

]);

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
  if (!isPublicRoute(req)) {
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
