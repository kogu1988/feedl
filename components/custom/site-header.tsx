"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { Show, UserButton, useAuth } from "@clerk/nextjs";

import { ClerkTriggerButton } from "@/components/custom/clerk-trigger-button";
import { ThemeToggle } from "@/components/custom/theme-toggle";
import { cn } from "@/lib/utils";

// Sprint 36: üst bar site kabuğunun parçası — marka işareti ve aktif sayfa
// durumu eklendi. usePathname client gerektirdiği için layout'tan buraya
// taşındı; ClerkProvider (main) layout'unda kalır.
// Sprint 50: nav satış (/, /demo, /alternative) ve ürün (/portal*, /roadmap*,
// /dashboard*) yüzeylerine göre değişir. Satış sayfalarında portal/yol
// haritası/güncellemeler çıkar; yerine Demo + Fiyat. Ürün sayfalarında
// mevcut ürün nav'ı kalır.
// Sprint 63+ (IA standardı — kullanıcı onayı) + 2026-09-06 revizyonu:
// nav artık hem yüzeye hem OTURUMA göre değişir.
//   Giriş yapmış kullanıcı (admin/team/member = ürünü kullanıyor) → her yerde
//     tam ürün nav'ı: Portal + Yol Haritası + Güncellemeler (owner her şeyi görür).
//   Anonim ziyaretçi → satış/marka (/, /demo, /alternative, /contact, legal) →
//     Demo + Fiyatlandırma; auth/işlem (/sign-in, /sign-up, /onboarding,
//     /invites) → nav YOK; public topluluk (portal/roadmap/changelog) →
//     Portal + Yol + Güncellemeler.
// Not: "/" satış eşleşmesi EXACT olmalı (startsWith("/") her path'e uyar —
// /portal'da Demo/Fiyat görünmesi bug'ı 2026-09-06'da düzeltildi).
const SALES_PREFIXES = ["/demo", "/contact", "/privacy", "/terms"];
const SALES_EXACT = ["/"];
const AUTH_APP_PREFIXES = ["/sign-in", "/sign-up", "/onboarding", "/invites"];

function isSalesSurface(pathname: string) {
  return (
    SALES_EXACT.includes(pathname) ||
    SALES_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const PRODUCT_NAV = [
  { href: "/portal", label: "Portal" },
  { href: "/roadmap", label: "Yol Haritası" },
  { href: "/changelog", label: "Güncellemeler" },
];
const SALES_NAV = [{ href: "/demo", label: "Demo" }];

function navItemsFor(pathname: string, isSignedIn: boolean) {
  // Giriş yapmış kullanıcı: ürünü kullanıyor — her yüzeyde tam ürün nav'ı.
  if (isSignedIn) {
    return PRODUCT_NAV;
  }
  // Anonim: satış/marka yüzeyi.
  if (isSalesSurface(pathname)) {
    return SALES_NAV;
  }
  // Anonim: auth/işlem yüzeyi — nav yok (yalnızca logo + temalar).
  if (AUTH_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return [];
  }
  // Anonim: public topluluk.
  return PRODUCT_NAV;
}

function isAuthSurface(pathname: string) {
  return AUTH_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Tek nav render kaynağı — masaüstü nave ve mobil panel aynı öğeleri farklı
// yoğunlukla basar. `variant="desktop"` (h-14 içi yatay) / `variant="mobile"`
// (dikey, tam genişlik). `onNavigate` mobilde menüyü kapatır.
function NavLinks({
  items,
  variant,
  pathname,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  variant: "desktop" | "mobile";
  pathname: string;
  onNavigate?: () => void;
}) {
  const isDesktop = variant === "desktop";
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "rounded-md font-medium transition-colors hover:bg-accent hover:text-foreground",
            isDesktop
              ? "px-2 py-1 text-sm whitespace-nowrap sm:px-2.5"
              : "px-3 py-2 text-sm",
            isActive(pathname, item.href)
              ? "bg-muted text-foreground"
              : "text-muted-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") {
    // /portal ve alt sayfaları ([id], oyladiklarim) Portal'ı aktif eder;
    // changelog üst seviyede (/changelog), kendi kuralıyla aktif olur.
    return pathname === "/portal" || pathname.startsWith("/portal/");
  }
  if (href === "/demo") {
    return pathname === "/demo";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  brand,
  contextWorkspaceName,
}: {
  brand?: { name: string; logoUrl: string | null };
  // 2026-09-12: kök host'ta (feedl.app) işaret her zaman feedl'dir. Aktif
  // workspace bağlamı dashboard'da ayrı bir çip olarak gösterilir — Slack/
  // Linear/Notion/Vercel/Sentry standardı (satıcı markası + workspace bağlamı).
  // Workspace host'unda (portal) çip YOKTUR; işaretin kendisi müşterinin markası.
  contextWorkspaceName?: string;
}) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Tam genişlik kararı (2026-09-05): üst bar tüm sayfalarda ekranın
  // tamamını kullanır — public/admin container ayrımı kalktı.
  const workspaceName = brand?.name ?? "feedl";
  const logoUrl = brand?.logoUrl ?? null;
  // Workspace bağlamı yalnız dashboard'da ve yalnız işaretten FARKLIYSA
  // gösterilir (varsayılan `feedl` workspace'inde gereksiz çip olmasın).
  const showWorkspaceContext =
    isSignedIn === true &&
    pathname.startsWith("/dashboard") &&
    !!contextWorkspaceName &&
    contextWorkspaceName.trim().toLowerCase() !== workspaceName.trim().toLowerCase();
  // Auth yüzeyinde giriş/kayıt butonları gösterilmez (kendi sayfasına giden
  // ölü link + P1 tekrar). Aksi halde anonimde gösterilir.
  const showAuthTriggers = !isSignedIn && !isAuthSurface(pathname);
  const navItems = navItemsFor(pathname, isSignedIn === true);

  // Mobil menüde gezinme başlayınca (route değişiminde) menüyü kapat.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container mx-auto flex h-14 max-w-none items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 font-bold tracking-tight"
          >
            {/* Sprint 63z: workspace logoUrl yoksa varsayılan turuncu marka logosu.
                Karonun içindeki ChevronsUpIcon yerine gerçek logo gösterilir; koyu
                ve açık modda görünür. logoUrl varsa onu kullan. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl ?? "/logo_brand_orange.svg"}
              alt=""
              className="size-6 shrink-0 object-contain"
              aria-hidden="true"
            />
            <span className="text-base">{workspaceName}</span>
          </Link>
          {showWorkspaceContext ? (
            <span
              className="hidden min-w-0 items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex"
              title="Aktif workspace"
            >
              <span className="truncate">{contextWorkspaceName}</span>
            </span>
          ) : null}
          {/* Masaüstü nav (md+); mobilde hamburger içinde. */}
          <nav
            className="hidden min-w-0 items-center gap-0.5 text-sm sm:gap-1 md:flex"
            aria-label="Site menüsü"
          >
            <NavLinks items={navItems} variant="desktop" pathname={pathname} />
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {/* Giriş/kayıt + UserButton yalnız masaüstünde (md+). */}
          <div className="hidden items-center gap-2 md:flex">
            <Show when="signed-out">
              {showAuthTriggers ? (
                <>
                  <ClerkTriggerButton
                    mode="sign-in"
                    variant="ghost"
                    size="sm"
                  >
                    Giriş yap
                  </ClerkTriggerButton>
                  <ClerkTriggerButton
                    mode="sign-up"
                    size="sm"
                    forceRedirectUrl="/onboarding"
                    fallbackRedirectUrl="/onboarding"
                  >
                    Kayıt ol
                  </ClerkTriggerButton>
                </>
              ) : null}
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
          {/* Mobilde hamburger (md-). Auth yüzeyinde nav zaten boşsa gizle. */}
          {navItems.length > 0 || showAuthTriggers ? (
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <XIcon className="size-5" aria-hidden="true" />
              ) : (
                <MenuIcon className="size-5" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobil menü paneli */}
      {mobileOpen ? (
        <div className="border-t bg-background px-4 py-3 md:hidden">
          <nav className="grid gap-1" aria-label="Mobil site menüsü">
            <NavLinks
              items={navItems}
              variant="mobile"
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
          {showAuthTriggers ? (
            <div className="mt-3 grid gap-2 border-t pt-3">
              <ClerkTriggerButton mode="sign-in" variant="outline" className="w-full">
                Giriş yap
              </ClerkTriggerButton>
              <ClerkTriggerButton
                mode="sign-up"
                className="w-full"
                forceRedirectUrl="/onboarding"
                fallbackRedirectUrl="/onboarding"
              >
                Kayıt ol
              </ClerkTriggerButton>
            </div>
          ) : null}
          {isSignedIn ? (
            <div className="mt-3 border-t pt-3">
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "justify-start",
                    avatarBox: "size-8",
                  },
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
