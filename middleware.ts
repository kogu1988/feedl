import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

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

  "/widget",
  "/api/posts(.*)",

  // Public API (Sprint 34): kimlik Bearer API key ile handler içinde
  // doğrulanır (lib/api-keys.ts), Clerk oturumu gerekmez
  "/api/v1(.*)",

  "/api/widget(.*)",
  "/api/webhooks(.*)",

  "/api/inngest(.*)",

  // Sprint 40: changelog e-posta aboneliği — anonim ziyaretçiler de
  // abone olabilir; e-posta formatı handler içinde doğrulanır
  "/api/changelog(.*)",

]);

// Middleware SADECE giriş kontrolü yapar. Admin yetkisi tek kaynak olarak
// Neon users.role alanından sayfa/API içinde kontrol edilir (plan.md Sprint 1).
export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
